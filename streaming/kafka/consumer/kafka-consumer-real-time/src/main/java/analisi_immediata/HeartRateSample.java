package analisi_immediata;

// I nomi dei campi devono combaciare con le chiavi JSON prodotte da heart_rate_simulator.py
public record HeartRateSample(
         String athlete_id,
         String sport,
         double heart_rate_bpm,
         String heart_rate_zone,
         double cadence_spm,
         double altitude_m,
         double latitude,
         double longitude,
         String timestamp,
         int sample_index,
         long session_id) {
}
