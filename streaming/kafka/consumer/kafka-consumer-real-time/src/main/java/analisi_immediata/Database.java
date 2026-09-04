package analisi_immediata;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

public class Database {

    public void databaseBulkInsert(List<CampioneDaSalvare> campioni) {
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
            System.out.printf("Inserimento batch di %d campioni nel database ClickHouse%n", campioni.size());
            try (java.sql.PreparedStatement stmt = conn.prepareStatement(sql)) {
                for (CampioneDaSalvare campione : campioni) {
                    HeartRateSample sample = campione.sample();
                    String rawTimestamp = sample.timestamp();
                    OffsetDateTime odt = OffsetDateTime.parse(rawTimestamp);
                    String formattedTimestamp = odt.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
                    stmt.setInt(1, sample.sample_id());
                    stmt.setLong(2, sample.session_id());
                    stmt.setLong(3, sample.athlete_id());
                    stmt.setString(4, formattedTimestamp);
                    stmt.setDouble(5, campione.velocita());
                    stmt.setDouble(6, sample.heart_rate());
                    stmt.setDouble(7, sample.latitude());
                    stmt.setDouble(8, sample.longitude());
                    stmt.setDouble(9, sample.altitude());
                    stmt.setDouble(10, sample.temperature());
                    stmt.setDouble(11, sample.cadence_spm());
                    stmt.setString(12, sample.event_type());
                    stmt.addBatch();
                }
                System.out.printf("Esecuzione batch di %d campioni nel database ClickHouse%n", campioni.size());
                stmt.executeBatch();
                //conn.commit();
            }
        } catch (java.sql.SQLException e) {
            System.err.println("Errore durante l'inserimento batch nel database: " + e.getMessage());
        }
    }


    public void databaseSummary(double velocitaMedia, double velocitaMax, double frequenzaCardiacaMedia, double frequenzaCardiacaMax, double cadenzaMedia, double distanzaTotale, int campioni, HeartRateSample sample, long timestamp) {
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


}