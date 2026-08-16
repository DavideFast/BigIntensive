-- Running samples
CREATE TABLE IF NOT EXISTS running_samples (
  sample_id BIGSERIAL PRIMARY KEY,
  athlete_id INT NOT NULL REFERENCES athletes(athlete_id) ON DELETE CASCADE,
  session_id BIGINT NOT NULL REFERENCES smartwatch_sessions(session_id) ON DELETE CASCADE,
  timestamp TIMESTAMP NOT NULL,
  heart_rate INT CHECK (heart_rate >= 0),
  latitude DECIMAL(9, 6),
  longitude DECIMAL(9, 6),
  altitude DECIMAL(5, 2),
  temperature DECIMAL(4, 2),
  cadence INT CHECK (cadence >= 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)ENGINE = MergeTree
ORDER BY (timestamp, athlete_id, session_id)
PARTITION BY toYYYYMM(timestamp);


-- Workout sessions
CREATE TABLE IF NOT EXISTS allenamenti (
    allenamento_id BIGSERIAL PRIMARY KEY,
    athlete_id INT NOT NULL REFERENCES athletes(athlete_id) ON DELETE CASCADE,
    data_allenamento DATE NOT NULL,
    serie_allenamento int NOT NULL CHECK (serie_allenamento > 0),
    ripetizioni_allenamento int NOT NULL CHECK (ripetizioni_allenamento > 0),
    recupero_allenamento int NOT NULL CHECK (recupero_allenamento >= 0),
    peso_allenamento DECIMAL(5, 2) CHECK (peso_allenamento >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)ENGINE = MergeTree
ORDER BY (data_allenamento, athlete_id, allenamento_id)
PARTITION BY toYYYYMM(data_allenamento);