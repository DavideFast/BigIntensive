package analisi_immediata;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.streams.KafkaStreams;
import org.apache.kafka.streams.StreamsBuilder;
import org.apache.kafka.streams.StreamsConfig;
import org.apache.kafka.streams.kstream.Consumed;
import org.apache.kafka.streams.kstream.KStream;
import org.apache.kafka.streams.kstream.Repartitioned;
import org.apache.kafka.streams.processor.api.Processor;
import org.apache.kafka.streams.processor.api.ProcessorContext;
import org.apache.kafka.streams.processor.api.Record;
import org.apache.kafka.streams.state.KeyValueStore;
import org.apache.kafka.streams.state.StoreBuilder;
import org.apache.kafka.streams.state.Stores;

import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

/** Rilevamento immobilita con Kafka Streams: lo stato sopravvive a riavvii e rebalance. */
public class StreamsAllarmi {

    private static final String TOPIC_INGRESSO = "heart-rate-events";
    private static final String NOME_STORE = "stato-sessioni";
    private static final double SOGLIA_MOVIMENTO_M = 10.0;
    private static final int SECONDI_IMMOBILE = 30;
    private static final double RAGGIO_TERRA_M = 6_371_000.0;
    private static final ObjectMapper MAPPER = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    private static final List<HeartRateSample> campioni = new ArrayList<>();
    private static double distanzaTotale= 0.0;
    private static double velocitaMedia= 0.0;
    private static double velocitaMax= 0.0;
    private static double frequenzaCardiacaMedia= 0.0;
    private static double frequenzaCardiacaMax= 0.0;
    private static double cadenzaMedia= 0.0;
    private static int campioniRicevuti = 0;
    private static final int MAX_CAMPIONI = 1000;


    /** Stato persistito nello state store, serializzato come JSON. */
    public record StatoSessione(double latitudine, double longitudine, int indice, boolean allarmeInviato) {
    }

    private static double distanzaMetri(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * RAGGIO_TERRA_M * Math.asin(Math.min(1.0, Math.sqrt(a)));
    }

    private static final class RilevatoreImmobilita implements Processor<String, String, String, String> {

        private KeyValueStore<String, String> store;
        private ProcessorContext<String, String> context;

        @Override
        public void init(ProcessorContext<String, String> context) {
            this.context = context;
            this.store = context.getStateStore(NOME_STORE);
        }

        public void flushBatch(long timestamp) {
            if (!campioni.isEmpty()) {
                databaseBulkInsert(campioni, timestamp);
                campioni.clear();
            }
        }

        private void databaseBulkInsert(List<HeartRateSample> samples, long timestamp) {
            // Simulazione di un inserimento batch nel database
            System.out.printf("Inserimento batch di %d campioni nel database al timestamp %d%n", samples.size(), timestamp);
        }

        private void databaseSummary(double velocitaMedia, double velocitaMax, double frequenzaCardiacaMedia, double frequenzaCardiacaMax, double cadenzaMedia, HeartRateSample sample, long timestamp) {
            // Simulazione di un inserimento di riepilogo nel database
            System.out.printf("Riepilogo al timestamp %d: velocità media %.2f m/s, velocità max %.2f m/s, frequenza cardiaca media %.2f bpm, frequenza cardiaca max %.2f bpm, cadenza media %.2f spm%n",
                    timestamp, velocitaMedia, velocitaMax, frequenzaCardiacaMedia, frequenzaCardiacaMax, cadenzaMedia);
            
        }

        @Override
        public void process(Record<String, String> record) {
            
            // Provo a vedere se l'evento che arriva ha una struttura JSON corretta
            HeartRateSample sample;
            try {
                sample = MAPPER.readValue(record.value(), HeartRateSample.class);

                frequenzaCardiacaMedia += sample.heart_rate_bpm();
                frequenzaCardiacaMax = Math.max(frequenzaCardiacaMax, sample.heart_rate_bpm());
                cadenzaMedia += sample.cadence_spm();

                campioni.add(sample);
                if (campioni.size() > MAX_CAMPIONI) {
                    flushBatch(context.currentStreamTimeMs());
                }
                if (campioni.size() > MAX_CAMPIONI) {
                    campioni.remove(0);
                }
            } catch (Exception e) {
                return; // messaggio malformato: scartato senza fermare la topologia
            }

            //Se il campo event_type è "session_end" allora elimino lo stato della sessione e non faccio altro
            if ("session_end".equals(sample.event_type())) {
                velocitaMedia = velocitaMedia / (sample.sample_index() + 1);
                cadenzaMedia = cadenzaMedia / (sample.sample_index() + 1);
                frequenzaCardiacaMedia = frequenzaCardiacaMedia / (sample.sample_index() + 1);
                databaseSummary(velocitaMedia, velocitaMax, frequenzaCardiacaMedia, frequenzaCardiacaMax, cadenzaMedia, sample, context.currentStreamTimeMs());
                store.delete(record.key());
                return;
            }

            //Se non c'è uno stato precedente lo creo e esco
            StatoSessione precedente = leggiStato(record.key());
            if (precedente == null) {
                salvaStato(record.key(), new StatoSessione(sample.latitude(), sample.longitude(), sample.sample_index(), false));
                return;
            }

            // Calcolo lo spostamento tra la posizione precedente e quella dell'evento corrente
            double spostamento = distanzaMetri(precedente.latitudine(), precedente.longitudine(),sample.latitude(), sample.longitude());

            double velocitaTratto = spostamento / (sample.sample_index() - precedente.indice());
            velocitaMedia = velocitaMedia + velocitaTratto;
            velocitaMax = Math.max(velocitaMax, velocitaTratto);

            // Se lo spostamento è maggiore della soglia, aggiorno lo stato e non faccio altro
            if (spostamento > SOGLIA_MOVIMENTO_M) {
                salvaStato(record.key(), new StatoSessione(sample.latitude(), sample.longitude(), sample.sample_index(), false));
                return;
            }

            // Calcolo da quanto tempo l'atleta è fermo
            int fermoDaSecondi = sample.sample_index() - precedente.indice();
            if (fermoDaSecondi >= SECONDI_IMMOBILE && !precedente.allarmeInviato() && sample.heart_rate_bpm() > 180) {
                salvaStato(record.key(), new StatoSessione(precedente.latitudine(), precedente.longitudine(),precedente.indice(), true));

                String messaggio = String.format("Atleta %s fermo da %d s in posizione %.6f, %.6f (bpm %.0f)",
                        sample.athlete_id(), fermoDaSecondi, sample.latitude(), sample.longitude(),sample.heart_rate_bpm());

                AllarmeNotifier.invia(messaggio);
                context.forward(record.withValue(messaggio));
            }
        }

        private StatoSessione leggiStato(String chiave) {
            String json = store.get(chiave);
            if (json == null) {
                return null;
            }
            try {
                return MAPPER.readValue(json, StatoSessione.class);
            } catch (Exception e) {
                return null;
            }
        }

        private void salvaStato(String chiave, StatoSessione stato) {
            try {
                store.put(chiave, MAPPER.writeValueAsString(stato));
            } catch (Exception e) {
                System.err.println("Stato non salvabile per " + chiave + ": " + e.getMessage());
            }
        }
    }

    public static void main(String[] args) {

        // Configurazione di Kafka Streams
        Properties props = new Properties();
        props.put(StreamsConfig.APPLICATION_ID_CONFIG, "rilevatore-immobilita");
        props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        props.put(StreamsConfig.DEFAULT_KEY_SERDE_CLASS_CONFIG, Serdes.String().getClass());
        props.put(StreamsConfig.DEFAULT_VALUE_SERDE_CLASS_CONFIG, Serdes.String().getClass());

        // Creazione dello state store persistente
        StoreBuilder<KeyValueStore<String, String>> store = Stores.keyValueStoreBuilder(
                Stores.persistentKeyValueStore(NOME_STORE), Serdes.String(), Serdes.String());

        //Creazione della pipeline di elaborazione dei messaggi
        StreamsBuilder builder = new StreamsBuilder();
        builder.addStateStore(store);

        // Lettura dei messaggi dal topic di ingresso
        KStream<String, String> sorgente = builder.stream(TOPIC_INGRESSO, Consumed.with(Serdes.String(), Serdes.String()));
        
        // Processamento dei messaggi con il rilevatore di immobilità
        sorgente.process(RilevatoreImmobilita::new, NOME_STORE);

        // Avvio del flusso di elaborazione
        KafkaStreams streams = new KafkaStreams(builder.build(), props);

        // Gestione della chiusura dell'applicazione
        Runtime.getRuntime().addShutdownHook(new Thread(streams::close));

        //Avvio del flusso di elaborazione
        streams.start();
    }
}
