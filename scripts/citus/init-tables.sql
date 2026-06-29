-- Athletes table
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

-- Exercise metrics table
CREATE TABLE IF NOT EXISTS exercise_metrics (
  metric_id BIGSERIAL,
  athlete_id INT NOT NULL REFERENCES athletes(athlete_id),
  esercizio VARCHAR(50) NOT NULL,
  valore_salto DECIMAL(10, 2) NOT NULL,
  rsi DECIMAL(10, 4) NOT NULL,
  differenza_bilaterale DECIMAL(10, 2) NOT NULL,
  potenza_sviluppata DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (athlete_id, metric_id)
);

-- Set exercise_metrics as distributed table with athlete_id as distribution column
SELECT create_distributed_table('exercise_metrics', 'athlete_id');

-- Endurance running cardio samples
CREATE TABLE IF NOT EXISTS cardio_endurance_samples (
  sample_id BIGSERIAL,
  athlete_id INT NOT NULL REFERENCES athletes(athlete_id),
  heart_rate_bpm DECIMAL(5, 1) NOT NULL,
  cadence_spm DECIMAL(5, 1) NOT NULL,
  speed_kmh DECIMAL(5, 2) NOT NULL,
  altitude_m DECIMAL(7, 2) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (athlete_id, sample_id)
);

-- Set cardio_endurance_samples as distributed table with athlete_id as distribution column
SELECT create_distributed_table('cardio_endurance_samples', 'athlete_id');

-- Create sample data
INSERT INTO athletes (nome, cognome, eta, sesso, altezza_cm, peso_kg)
VALUES 
  ('Marco', 'Rossi', 28, 'M', 182, 80.5),
  ('Giulia', 'Bianchi', 25, 'F', 168, 62.3),
  ('Alessandro', 'Verdi', 32, 'M', 175, 75.0)
ON CONFLICT DO NOTHING;

-- Create view for latest athlete data
CREATE OR REPLACE VIEW athletes_latest AS
SELECT 
  athlete_id,
  nome,
  cognome,
  eta,
  sesso,
  altezza_cm,
  peso_kg,
  created_at,
  updated_at
FROM athletes
ORDER BY updated_at DESC;
