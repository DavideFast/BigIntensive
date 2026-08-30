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
import java.util.concurrent.CountDownLatch;

/** Rilevamento immobilita con Kafka Streams: lo stato sopravvive a riavvii e rebalance. */
public class StreamsAllarmi {

    private static final String TOPIC_INGRESSO_PREDEFINITO = "heart-rate-events";
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
            String url = System.getenv("CLICKHOUSE_URL");
            if (url == null || url.isEmpty()) {
                url = "jdbc:clickhouse://localhost:8123/default";
            }
            String user = System.getenv("CLICKHOUSE_USER");
            if (user == null || user.isEmpty()) {
                user = "default";
            }
            String password = System.getenv("CLICKHOUSE_PASSWORD");
            if (password == null) {
                password = "";
            }
            try (java.sql.Connection conn = java.sql.DriverManager.getConnection(url, user, password)) {
                String sql = "INSERT INTO heart_rate_samples (athlete_id, sample_index, latitude, longitude, heart_rate_bpm, cadence_spm, event_type) VALUES (?, ?, ?, ?, ?, ?, ?)";
                try (java.sql.PreparedStatement stmt = conn.prepareStatement(sql)) {
                    for (HeartRateSample sample : samples) {
                        stmt.setString(1, sample.athlete_id());
                        stmt.setInt(2, sample.sample_index());
                        stmt.setDouble(3, sample.latitude());
                        stmt.setDouble(4, sample.longitude());
                        stmt.setDouble(5, sample.heart_rate_bpm());
                        stmt.setDouble(6, sample.cadence_spm());
                        stmt.setString(7, sample.event_type());
                        stmt.addBatch();
                    }
                    stmt.executeBatch();
                }
            } catch (java.sql.SQLException e) {
                System.err.println("Errore durante l'inserimento batch nel database: " + e.getMessage());
            }
        }

        private void databaseSummary(double velocitaMedia, double velocitaMax, double frequenzaCardiacaMedia, double frequenzaCardiacaMax, double cadenzaMedia, double distanzaTotale, int campioni, HeartRateSample sample, long timestamp) {
            String url = System.getenv("POSTGRES_URL");
            if (url == null || url.isEmpty()) {
                url = "jdbc:postgresql://localhost:5432/default";
            }
            String user = System.getenv("POSTGRES_USER");
            if (user == null || user.isEmpty()) {
                user = "postgres";
            }
            String password = System.getenv("POSTGRES_PASSWORD");
            if (password == null) {
                password = "postgres";
            }
            try (java.sql.Connection conn = java.sql.DriverManager.getConnection(url, user, password)) {
                String sql = "INSERT INTO session_summary (athlete_id, velocita_media, velocita_max, frequenza_cardiaca_media, frequenza_cardiaca_max, cadenza_media, distanza_totale, campioni, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
                try (java.sql.PreparedStatement stmt = conn.prepareStatement(sql)) {
                    stmt.setString(1, sample.athlete_id());
                    stmt.setDouble(2, velocitaMedia);
                    stmt.setDouble(3, velocitaMax);
                    stmt.setDouble(4, frequenzaCardiacaMedia);
                    stmt.setDouble(5, frequenzaCardiacaMax);
                    stmt.setDouble(6, cadenzaMedia);
                    stmt.setDouble(7, distanzaTotale);
                    stmt.setInt(8, campioni * 5);
                    stmt.setLong(8, timestamp);
                    stmt.executeUpdate();
                }
            
            } catch (java.sql.SQLException e) {
                System.err.println("Errore durante l'inserimento del riepilogo nel database: " + e.getMessage());
            }
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
                campioniRicevuti++;
                

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

            String chiave = record.key();
            if (chiave == null || chiave.isBlank()) {
                chiave = sample.athlete_id() + "-" + sample.session_id();
            }

            //Se il campo event_type è "session_end" allora elimino lo stato della sessione e non faccio altro
            if ("session_end".equals(sample.event_type())) {
                velocitaMedia = velocitaMedia / campioniRicevuti;
                cadenzaMedia = cadenzaMedia / campioniRicevuti;
                frequenzaCardiacaMedia = frequenzaCardiacaMedia / campioniRicevuti;
                distanzaTotale = distanzaTotale / campioniRicevuti;
                databaseSummary(velocitaMedia, velocitaMax, frequenzaCardiacaMedia, frequenzaCardiacaMax, cadenzaMedia, distanzaTotale, campioniRicevuti,  sample, context.currentStreamTimeMs());
                store.delete(chiave);
                return;
            }

            //Se non c'è uno stato precedente lo creo e esco
            StatoSessione precedente = leggiStato(chiave);
            if (precedente == null) {
                salvaStato(chiave, new StatoSessione(sample.latitude(), sample.longitude(), sample.sample_index(), false));
                return;
            }

            // Calcolo lo spostamento tra la posizione precedente e quella dell'evento corrente
            double spostamento = distanzaMetri(precedente.latitudine(), precedente.longitudine(),sample.latitude(), sample.longitude());
            distanzaTotale += spostamento;
            double velocitaTratto = spostamento / (sample.sample_index() - precedente.indice());
            velocitaMedia = velocitaMedia + velocitaTratto;
            velocitaMax = Math.max(velocitaMax, velocitaTratto);

            // Se lo spostamento è maggiore della soglia, aggiorno lo stato e non faccio altro
            if (spostamento > SOGLIA_MOVIMENTO_M) {
                salvaStato(chiave, new StatoSessione(sample.latitude(), sample.longitude(), sample.sample_index(), false));
                return;
            }

            // Calcolo da quanto tempo l'atleta è fermo
            int fermoDaSecondi = sample.sample_index() - precedente.indice();
            if (fermoDaSecondi >= SECONDI_IMMOBILE && !precedente.allarmeInviato() && sample.heart_rate_bpm() > 180) {
                salvaStato(chiave, new StatoSessione(precedente.latitudine(), precedente.longitudine(),precedente.indice(), true));

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

        // Configurazione di Kafka Streams - Legge da variabili d'ambiente
        String bootstrapServers = System.getenv("KAFKA_BOOTSTRAP_SERVERS");
        if (bootstrapServers == null || bootstrapServers.isEmpty()) {
            bootstrapServers = "localhost:9092";
        }
        String topicIngresso = System.getenv("KAFKA_TOPIC");
        if (topicIngresso == null || topicIngresso.isBlank()) {
            topicIngresso = TOPIC_INGRESSO_PREDEFINITO;
        }

        Properties props = new Properties();
        props.put(StreamsConfig.APPLICATION_ID_CONFIG, "rilevatore-immobilita");
        props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(StreamsConfig.DEFAULT_KEY_SERDE_CLASS_CONFIG, Serdes.String().getClass());
        props.put(StreamsConfig.DEFAULT_VALUE_SERDE_CLASS_CONFIG, Serdes.String().getClass());

        // Creazione dello state store persistente
        StoreBuilder<KeyValueStore<String, String>> store = Stores.keyValueStoreBuilder(
                Stores.persistentKeyValueStore(NOME_STORE), Serdes.String(), Serdes.String());

        //Creazione della pipeline di elaborazione dei messaggi
        StreamsBuilder builder = new StreamsBuilder();
        builder.addStateStore(store);

        // Lettura dei messaggi dal topic di ingresso
        KStream<String, String> sorgente = builder.stream(topicIngresso, Consumed.with(Serdes.String(), Serdes.String()));
        
        // Processamento dei messaggi con il rilevatore di immobilità
        sorgente.process(RilevatoreImmobilita::new, NOME_STORE);

        // Avvio del flusso di elaborazione
        KafkaStreams streams = new KafkaStreams(builder.build(), props);
        CountDownLatch shutdownLatch = new CountDownLatch(1);

        // Gestione della chiusura dell'applicazione
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            streams.close();
            shutdownLatch.countDown();
        }));

        //Avvio del flusso di elaborazione
        System.out.println("Avvio del rilevatore di immobilità...");
        streams.start();
        try {
            shutdownLatch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            streams.close();
        }
    }
}
