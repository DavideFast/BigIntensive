-- Running samples
CREATE TABLE IF NOT EXISTS running_samples (
  sample_id UInt64,
  athlete_id UInt64,
  session_id UInt64,
  timestamp DateTime DEFAULT now(),
  heart_rate UInt8,
  latitude DECIMAL(9, 6),
  longitude DECIMAL(9, 6),
  altitude DECIMAL(5, 2),
  temperature DECIMAL(4, 2),
  cadence UInt8,
  created_at DateTime DEFAULT now()
)ENGINE = MergeTree
ORDER BY (timestamp, athlete_id, session_id)
PARTITION BY toYYYYMM(timestamp);


-- Workout sessions
CREATE TABLE IF NOT EXISTS allenamenti (
    allenamento_id UInt64,
    athlete_id UInt64 ,
    data_allenamento DateTime NOT NULL,
    esercizio_id UInt64 NOT NULL,
    serie_allenamento UInt8 NOT NULL,
    ripetizioni_allenamento UInt8 NOT NULL,
    recupero_allenamento UInt8 NOT NULL,
    peso_allenamento DECIMAL(5, 2),
    created_at DateTime DEFAULT now()
)ENGINE = MergeTree
ORDER BY (data_allenamento, athlete_id, allenamento_id)
PARTITION BY toYYYYMM(data_allenamento);