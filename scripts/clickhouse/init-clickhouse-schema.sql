-- Schema ClickHouse pre-impostato per BigIntensive
-- Eseguire questo file prima di npm run seed:fake

CREATE DATABASE IF NOT EXISTS bigintensive;

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
