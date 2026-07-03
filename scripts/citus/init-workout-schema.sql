-- Citus tables aligned to scripts/citus/esempio_dati.js
-- Keep only: athletes, exercises, training_status.

CREATE TABLE IF NOT EXISTS athletes (
  athlete_id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  cognome VARCHAR(100) NOT NULL,
  eta INT CHECK (eta > 0 AND eta < 150),
  sesso CHAR(1) CHECK (sesso IN ('M', 'F', 'O')),
  altezza_cm INT CHECK (altezza_cm > 50 AND altezza_cm < 300),
  peso_kg DECIMAL(5, 2) CHECK (peso_kg > 10 AND peso_kg < 500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exercises (
  exercise_id SERIAL PRIMARY KEY,
  nome_esercizio VARCHAR(150) NOT NULL,
  descrizione TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS training_status (
  status_id BIGSERIAL,
  athlete_id INT NOT NULL REFERENCES athletes(athlete_id),
  giorno DATE NOT NULL,
  valore SMALLINT NOT NULL CHECK (valore >= 0 AND valore <= 100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (athlete_id, status_id),
  CONSTRAINT uq_training_status_day UNIQUE (athlete_id, giorno)
);

-- Keep small dimensions replicated on all workers.
SELECT create_reference_table('athletes');
SELECT create_reference_table('exercises');

-- Write-heavy status table distributed by athlete.
SELECT create_distributed_table('training_status', 'athlete_id');

CREATE INDEX IF NOT EXISTS idx_training_status_day ON training_status (athlete_id, giorno DESC);
