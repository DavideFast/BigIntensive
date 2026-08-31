package analisi_immediata;
import org.apache.kafka.streams.processor.api.Processor;
import org.apache.kafka.streams.processor.api.ProcessorContext;
import org.apache.kafka.streams.state.KeyValueStore;

import org.apache.kafka.streams.processor.api.Record;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;

import analisi_immediata.StreamsAllarmi.StatoSessione;

import java.util.ArrayList;
import java.util.List;

class RilevatoreImmobilita implements Processor<String, String, String, String> {
    
    private double distanzaTotale= 0.0;
    private double velocitaMedia= 0.0;
    private double velocitaMax= 0.0;
    private double frequenzaCardiacaMedia= 0.0;
    private double frequenzaCardiacaMax= 0.0;
    private double cadenzaMedia= 0.0;
    private int campioniRicevuti = 0;
    private KeyValueStore<String, String> store;
    private ProcessorContext<String, String> context;
    private final List<HeartRateSample> campioniAnalisi = new ArrayList<>();
    private final List<HeartRateSample> campioniDB = new ArrayList<>();
    private static final int MAX_CAMPIONI = 2000;
    private static final int MAX_CAMPIONI_ANALISI = 1000;
    private static final double SOGLIA_MOVIMENTO_M = 10.0;
    private static final int SECONDI_IMMOBILE = 30;
    private static final double RAGGIO_TERRA_M = 6_371_000.0;
    private static final ObjectMapper MAPPER = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private static double distanzaMetri(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * RAGGIO_TERRA_M * Math.asin(Math.min(1.0, Math.sqrt(a)));
    } 
    
    @Override
    public void init(ProcessorContext<String, String> context) {
        this.context = context;
        this.store = context.getStateStore(StreamsAllarmi.getNomeStore());
        this.campioniAnalisi.clear();
    }

    public void flushBatch(long timestamp) {
        if (!campioniDB.isEmpty()) {
            System.out.printf("Flushing batch of %d samples to database at timestamp %d%n", campioniDB.size(), timestamp);
            databaseBulkInsert(campioniDB, timestamp);
            campioniDB.clear();
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
            String sql = "INSERT INTO running_samples (sample_id, session_id, athlete_id, timestamp, heart_rate, latitude, longitude, altitude, temperature, cadence, event_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            System.out.printf("Inserimento batch di %d campioni nel database ClickHouse%n", samples.size());
            try (java.sql.PreparedStatement stmt = conn.prepareStatement(sql)) {
                for (HeartRateSample sample : samples) {
                    stmt.setInt(1, sample.sample_index());
                    stmt.setLong(2, sample.session_id());
                    stmt.setInt(3, sample.athlete_id());
                    stmt.setString(4, sample.timestamp());
                    stmt.setDouble(5, sample.heart_rate_bpm());
                    stmt.setDouble(6, sample.latitude());
                    stmt.setDouble(7, sample.longitude());
                    stmt.setDouble(8, sample.altitude());
                    stmt.setDouble(9, sample.temperature());
                    stmt.setDouble(10, sample.cadence_spm());
                    stmt.setString(11, sample.event_type());
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
                stmt.setInt(1, sample.athlete_id());
                stmt.setDouble(2, velocitaMedia);
                stmt.setDouble(3, velocitaMax);
                stmt.setDouble(4, frequenzaCardiacaMedia);
                stmt.setDouble(5, frequenzaCardiacaMax);
                stmt.setDouble(6, cadenzaMedia);
                stmt.setDouble(7, distanzaTotale);
                stmt.setInt(8, campioni * 5);
                stmt.setLong(9, timestamp);
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
        //System.out.printf("Ricevuto evento");
        try {
            sample = MAPPER.readValue(record.value(), HeartRateSample.class);

            frequenzaCardiacaMedia += sample.heart_rate_bpm();
            frequenzaCardiacaMax = Math.max(frequenzaCardiacaMax, sample.heart_rate_bpm());
            cadenzaMedia += sample.cadence_spm();
            campioniRicevuti++;
            
            campioniAnalisi.add(sample);
            campioniDB.add(sample);
            System.out.println(campioniDB.size());
            if (campioniDB.size() > MAX_CAMPIONI) {
                System.out.printf("Raggiunto limite di %d campioni, invio batch al database%n", MAX_CAMPIONI);
                flushBatch(context.currentStreamTimeMs());
            }
            if (campioniAnalisi.size() > MAX_CAMPIONI_ANALISI) {
                campioniAnalisi.remove(0);
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
        //System.out.printf("Atleta %s: spostamento %.2f m, velocità %.2f m/s, velocità media %.2f m/s, velocità max %.2f m/s, distanza totale %.2f m%n",
        //        sample.athlete_id(), spostamento, velocitaTratto, velocitaMedia / campioniRicevuti, velocitaMax, distanzaTotale);

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

