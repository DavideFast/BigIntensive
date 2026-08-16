-- Running samples
CREATE TABLE IF NOT EXISTS running_samples (
  sample_id UInt64,
  athlete_id UInt64,
  session_id UInt64,
  timestamp DateTime,
  heart_rate UInt8 CHECK (heart_rate >= 0),
  latitude DECIMAL(9, 6),
  longitude DECIMAL(9, 6),
  altitude DECIMAL(5, 2),
  temperature DECIMAL(4, 2),
  cadence UInt8 CHECK (cadence >= 0),
  created_at DateTime
)ENGINE = MergeTree
ORDER BY (timestamp, athlete_id, session_id)
PARTITION BY toYYYYMM(timestamp);


-- Workout sessions
CREATE TABLE IF NOT EXISTS allenamenti (
    allenamento_id UInt64 PRIMARY KEY,
    athlete_id UInt64 ,
    data_allenamento DATE NOT NULL,
    serie_allenamento UInt8 NOT NULL CHECK (serie_allenamento > 0),
    ripetizioni_allenamento UInt8 NOT NULL CHECK (ripetizioni_allenamento > 0),
    recupero_allenamento UInt8 NOT NULL CHECK (recupero_allenamento >= 0),
    peso_allenamento DECIMAL(5, 2) CHECK (peso_allenamento >= 0),
    created_at DateTime
)ENGINE = MergeTree
ORDER BY (data_allenamento, athlete_id, allenamento_id)
PARTITION BY toYYYYMM(data_allenamento);