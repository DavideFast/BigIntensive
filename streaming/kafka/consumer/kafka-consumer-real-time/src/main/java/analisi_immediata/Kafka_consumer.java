package analisi_immediata;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.kafka.clients.consumer.*;
import org.apache.kafka.common.serialization.StringDeserializer;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Collections;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

public class Kafka_consumer {

    private static final double RAGGIO_TERRA_M = 6_371_000.0;

    // Piu campioni riducono il rumore GPS ma appiattiscono le variazioni rapide di andatura
    private static final int FINESTRA_CAMPIONI = 5;

    // Deve superare il rumore GPS (~3 m) per non scambiare il jitter per movimento reale
    private static final double SOGLIA_MOVIMENTO_M = 10.0;

    private static final int SECONDI_IMMOBILE = 30;

    private static final class StatoSessione {
        HeartRateSample ultimoMovimento;
        boolean allarmeInviato;
    }

    // Distanza in metri tra due coordinate sulla superficie terrestre (formula dell'emisenoverso)
    private static double distanzaMetri(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * RAGGIO_TERRA_M * Math.asin(Math.min(1.0, Math.sqrt(a)));
    }

    private static void verificaStatoPericoloso(Map<String, StatoSessione> stati, String chiave,
            HeartRateSample sample) {
        StatoSessione stato = stati.computeIfAbsent(chiave, k -> new StatoSessione());
        if (stato.ultimoMovimento == null) {
            stato.ultimoMovimento = sample;
            return;
        }

        double spostamento = distanzaMetri(stato.ultimoMovimento.latitude(), stato.ultimoMovimento.longitude(),
                sample.latitude(), sample.longitude());

        if (spostamento > SOGLIA_MOVIMENTO_M) {
            stato.ultimoMovimento = sample;
            stato.allarmeInviato = false;
            return;
        }

        int fermoDaSecondi = sample.sample_index() - stato.ultimoMovimento.sample_index();
        if (fermoDaSecondi >= SECONDI_IMMOBILE && !stato.allarmeInviato) {
            stato.allarmeInviato = true; // una sola notifica finche non riprende a muoversi
            AllarmeNotifier.invia(String.format("Atleta %s fermo da %d s in posizione %.6f, %.6f (bpm %.0f)",
                    sample.athlete_id(), fermoDaSecondi, sample.latitude(), sample.longitude(),
                    sample.heart_rate_bpm()));
        }
    }

    public static void main(String[] args) {
        Properties props = new Properties();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "my-group");
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "true");

        // Ignora eventuali campi nuovi aggiunti dal producer invece di fallire
        ObjectMapper mapper = new ObjectMapper()
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        // Ultimi campioni per ogni atleta/sessione, serve a calcolare lo spostamento su finestra
        Map<String, Deque<HeartRateSample>> finestre = new HashMap<>();
        Map<String, StatoSessione> stati = new HashMap<>();

        try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props)) {
            String topicName = "heart-rate-events";
            consumer.subscribe(Collections.singletonList(topicName));
            while (true) {
                ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(100));
                for (ConsumerRecord<String, String> kafkaRecord : records) {
                    try {
                        HeartRateSample sample = mapper.readValue(kafkaRecord.value(), HeartRateSample.class);
                        String chiave = sample.athlete_id() + "#" + sample.session_id();

                        // Marcatore di fine trasmissione: permette ai consumer di chiudere la sessione
                        if ("session_end".equals(sample.event_type())) {
                            finestre.remove(chiave);
                            stati.remove(chiave);
                            System.out.printf("%s sessione %d terminata dopo %d campioni%n",
                                    sample.athlete_id(), sample.session_id(), sample.sample_index());
                            continue;
                        }

                        verificaStatoPericoloso(stati, chiave, sample);

                        Deque<HeartRateSample> finestra = finestre.computeIfAbsent(chiave, k -> new ArrayDeque<>());
                        finestra.addLast(sample);
                        while (finestra.size() > FINESTRA_CAMPIONI) {
                            finestra.removeFirst();
                        }

                        // Se non ci sono almeno due campioni non si può calcolare la velocità
                        if (finestra.size() < 2) {
                            System.out.printf("%s idx=%d in attesa di campioni sufficienti%n",
                                    sample.athlete_id(), sample.sample_index());
                            continue;
                        }

                        HeartRateSample primo = finestra.peekFirst();

                        // Con sample_rate_hz=1 ogni indice vale un secondo
                        double dtSecondi = sample.sample_index() - primo.sample_index();
                        if (dtSecondi <= 0) {
                            continue; // campione duplicato o fuori ordine
                        }

                        // Solo primo e ultimo punto: sommare i segmenti accumulerebbe il rumore GPS
                        double metri = distanzaMetri(primo.latitude(), primo.longitude(), sample.latitude(), sample.longitude());
                        double velocitaKmh = metri / dtSecondi * 3.6;

                        System.out.printf("%s idx=%d bpm=%.1f | GPS: %.1f m in %.0f s -> %.2f km/h%n",
                                sample.athlete_id(), sample.sample_index(), sample.heart_rate_bpm(),
                                metri, dtSecondi, velocitaKmh);
                    } catch (Exception parseError) {
                        // Un messaggio malformato non deve fermare il consumo degli altri
                        System.err.println("Messaggio non parsabile all'offset " + kafkaRecord.offset() + ": " + parseError.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("An error occurred: " + e.getMessage());
        }
    }
}