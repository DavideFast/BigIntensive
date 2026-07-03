-- Schema ClickHouse pre-impostato per BigIntensive
-- Eseguire questo file prima di npm run seed:fake

CREATE DATABASE IF NOT EXISTS bigintensive;

CREATE TABLE IF NOT EXISTS bigintensive.allenamenti (
  allenamento_id UInt32,
  atleta_id UInt32,
  nome_allenamento String,
  descrizione String,
  durata_min UInt16,
  ts DateTime
) ENGINE = MergeTree
ORDER BY (ts, atleta_id, allenamento_id)
PARTITION BY toYYYYMM(ts);

CREATE TABLE IF NOT EXISTS bigintensive.allenamento_dettagli (
  allenamento_id UInt32,
  atleta_id UInt32,
  esercizio_id UInt32,
  ordine UInt16,
  serie UInt16,
  ripetizioni UInt16,
  tempo_riposo_sec UInt16,
  risultato Float32,
  ts DateTime
) ENGINE = MergeTree
ORDER BY (ts, atleta_id, allenamento_id, ordine)
PARTITION BY toYYYYMM(ts);

CREATE TABLE IF NOT EXISTS bigintensive.corsa_endurance_sessioni (
  atleta_id UInt32,
  sessione_id UInt32,
  commento String,
  ts DateTime
) ENGINE = MergeTree
ORDER BY (ts, atleta_id, sessione_id)
PARTITION BY toYYYYMM(ts);

CREATE TABLE IF NOT EXISTS bigintensive.corsa_endurance_campioni (
  atleta_id UInt32,
  sessione_id UInt32,
  secondo UInt16,
  heart_rate_bpm Float32,
  cadence_spm Float32,
  speed_kmh Float32,
  altitude_m Float32,
  ts DateTime
) ENGINE = MergeTree
ORDER BY (ts, atleta_id, sessione_id, secondo)
PARTITION BY toYYYYMM(ts);

CREATE TABLE IF NOT EXISTS bigintensive.workout_metrics (
  athlete_id UInt32,
  workout_id UInt32,
  timestamp DateTime,
  power Float32,
  heart_rate UInt16,
  cadence UInt16,
  speed Float32,
  distance Float32
) ENGINE = MergeTree
ORDER BY (timestamp, athlete_id)
PARTITION BY toYYYYMM(timestamp);

CREATE TABLE IF NOT EXISTS bigintensive.sensor_data (
  sensor_id UInt32,
  timestamp DateTime,
  value Float32,
  sensor_type String
) ENGINE = MergeTree
ORDER BY (timestamp, sensor_id)
PARTITION BY toYYYYMM(timestamp);
