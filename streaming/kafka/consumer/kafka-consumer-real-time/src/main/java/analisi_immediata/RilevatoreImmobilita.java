package analisi_immediata;
import org.apache.kafka.streams.processor.api.Processor;
import org.apache.kafka.streams.processor.api.ProcessorContext;
import org.apache.kafka.streams.state.KeyValueStore;

import org.apache.kafka.streams.processor.api.Record;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;

import analisi_immediata.ConsumerKafka.StatoSessione;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
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
    private int id_istanza = 0;

    private final List<HeartRateSample> campioniAnalisi = new ArrayList<>();
    private final List<HeartRateSample> campioniDB = new ArrayList<>();

    private static final int MAX_CAMPIONI = 2000;
    private static final int MAX_CAMPIONI_ANALISI = 1000;
    private static final double SOGLIA_MOVIMENTO_M = 10.0;
    private static final int SECONDI_IMMOBILE = 30;
    private static final double RAGGIO_TERRA_M = 6_371_000.0;
    private static final ObjectMapper MAPPER = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    private static int NUMERO_ISTANZE = 0;

    private static void setNumeroIstanze() {
        NUMERO_ISTANZE++;
    }

    private static double distanzaMetri(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * RAGGIO_TERRA_M * Math.asin(Math.min(1.0, Math.sqrt(a)));
    } 

    private void databaseBulkInsert(List<HeartRateSample> samples, long timestamp, double velocitaMediaTratto) {
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
        System.out.printf("Connessione al database ClickHouse %s con utente %s%n", url, user);
        try (java.sql.Connection conn = java.sql.DriverManager.getConnection(url, user, password)) {
            String sql = "INSERT INTO running_samples (sample_id, session_id, athlete_id, timestamp, velocity, heart_rate, latitude, longitude, altitude, temperature, cadence, event_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            System.out.printf("Inserimento batch di %d campioni nel database ClickHouse%n", samples.size());
            try (java.sql.PreparedStatement stmt = conn.prepareStatement(sql)) {
                for (HeartRateSample sample : samples) {
                    String rawTimestamp = sample.timestamp();
                    OffsetDateTime odt = OffsetDateTime.parse(rawTimestamp);
                    String formattedTimestamp = odt.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
                    stmt.setInt(1, sample.sample_id());
                    stmt.setLong(2, sample.session_id());
                    stmt.setLong(3, sample.athlete_id());
                    stmt.setString(4, formattedTimestamp);
                    stmt.setDouble(5, velocitaMediaTratto);
                    stmt.setDouble(6, sample.heart_rate());
                    stmt.setDouble(7, sample.latitude());
                    stmt.setDouble(8, sample.longitude());
                    stmt.setDouble(9, sample.altitude());
                    stmt.setDouble(10, sample.temperature());
                    stmt.setDouble(11, sample.cadence_spm());
                    stmt.setString(12, sample.event_type());
                    stmt.addBatch();
                }
                System.out.printf("Esecuzione batch di %d campioni nel database ClickHouse%n", samples.size());
                stmt.executeBatch();
                //conn.commit();
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

    @Override
    public void init(ProcessorContext<String, String> context) {
        this.context = context;
        this.store = context.getStateStore(ConsumerKafka.getNomeStore());
        setNumeroIstanze();
        this.id_istanza = NUMERO_ISTANZE;
    }

    @Override
    public void process(Record<String, String> record) {
        
        // Provo a vedere se l'evento che arriva ha una struttura JSON corretta
        HeartRateSample sample;
        //System.out.printf("Ricevuto evento");
        try {
            sample = MAPPER.readValue(record.value(), HeartRateSample.class);

            frequenzaCardiacaMedia += sample.heart_rate();
            frequenzaCardiacaMax = Math.max(frequenzaCardiacaMax, sample.heart_rate());
            cadenzaMedia += sample.cadence_spm();
            campioniRicevuti++;

            String chiave = record.key();
            if (chiave == null || chiave.isBlank()) {
                chiave = sample.athlete_id() + "-" + sample.session_id();
            }

            //Se non c'è uno stato precedente lo creo e esco
            StatoSessione precedente = leggiStato(chiave);
            if (precedente == null) {
                salvaStato(chiave, new StatoSessione(sample.latitude(), sample.longitude(), sample.sample_id(), false));
                return;
            }

            // Calcolo lo spostamento tra la posizione precedente e quella dell'evento corrente
            double spostamento = distanzaMetri(precedente.latitudine(), precedente.longitudine(),sample.latitude(), sample.longitude());
            distanzaTotale += spostamento;
            double velocitaTratto = spostamento / (sample.sample_id() - precedente.indice());
            velocitaMedia = velocitaMedia + velocitaTratto;
            velocitaMax = Math.max(velocitaMax, velocitaTratto);

            
            campioniAnalisi.add(sample);
            campioniDB.add(sample);
            for(int i = 0; i < id_istanza; i++) {
                System.out.print("-------");
            }
            System.out.println(campioniDB.size());
            if (campioniDB.size() >= MAX_CAMPIONI) {
                List<HeartRateSample> batchToFlush = new ArrayList<>(campioniDB.subList(0, MAX_CAMPIONI));
                System.out.printf("Raggiunto limite di %d campioni, invio batch al database%n", MAX_CAMPIONI);
                campioniDB.subList(0, MAX_CAMPIONI).clear();
                databaseBulkInsert(batchToFlush, context.currentStreamTimeMs(), velocitaTratto);
            }
            if (campioniAnalisi.size() > MAX_CAMPIONI_ANALISI) {
                campioniAnalisi.remove(0);
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

        

            // Se lo spostamento è maggiore della soglia, aggiorno lo stato e non faccio altro
            if (spostamento > SOGLIA_MOVIMENTO_M) {
                salvaStato(chiave, new StatoSessione(sample.latitude(), sample.longitude(), sample.sample_id(), false));
                return;
            }

            // Calcolo da quanto tempo l'atleta è fermo
            int fermoDaSecondi = sample.sample_id() - precedente.indice();
            if (fermoDaSecondi >= SECONDI_IMMOBILE && !precedente.allarmeInviato() && sample.heart_rate() > 180) {
                salvaStato(chiave, new StatoSessione(precedente.latitudine(), precedente.longitudine(),precedente.indice(), true));

                String messaggio = String.format("Atleta %s fermo da %d s in posizione %.6f, %.6f (bpm %.0f)",
                        sample.athlete_id(), fermoDaSecondi, sample.latitude(), sample.longitude(),sample.heart_rate());

                AllarmeNotifier.invia(messaggio);
                context.forward(record.withValue(messaggio));
            }
        } catch (Exception e) {
            return; // messaggio malformato: scartato senza fermare la topologia
        }      
    }
}

