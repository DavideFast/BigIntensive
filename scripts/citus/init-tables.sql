-- Single canonical Citus schema/bootstrap file.
-- Aligned to scripts/citus/esempio_dati.js.
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

CREATE TABLE IF NOT EXISTS jobs_in_coda (
  athlete_id INT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE jobs_in_coda
  DROP CONSTRAINT IF EXISTS jobs_in_coda_athlete_id_fkey;

ALTER TABLE jobs_in_coda
  ADD CONSTRAINT fk_jobs_in_coda_athlete
  FOREIGN KEY (athlete_id)
  REFERENCES athletes(athlete_id)
  ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS exercises (
  exercise_id SERIAL PRIMARY KEY,
  nome_esercizio VARCHAR(150) NOT NULL,
  tipo_esercizio VARCHAR(50) CHECK (tipo_esercizio IN ('forza', 'endurance', 'mobilità')),
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

CREATE TABLE IF NOT EXISTS smartwatch_sessions (
  session_id BIGSERIAL PRIMARY KEY,
  athlete_id INT NOT NULL REFERENCES athletes(athlete_id) ON DELETE CASCADE,
  topic VARCHAR(255) NOT NULL DEFAULT 'heart-rate-events',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  samples_sent INT NOT NULL DEFAULT 0 CHECK (samples_sent >= 0),
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  end_reason TEXT
);

SELECT create_reference_table('athletes');
SELECT create_reference_table('exercises');
SELECT create_reference_table('jobs_in_coda');
SELECT create_reference_table('smartwatch_sessions');
SELECT create_distributed_table('training_status', 'athlete_id');

INSERT INTO athletes (nome, cognome, eta, sesso, altezza_cm, peso_kg)
VALUES 
  ('Marco', 'Rossi', 28, 'M', 182, 80.5),
  ('Giulia', 'Bianchi', 25, 'F', 168, 62.3),
  ('Alessandro', 'Verdi', 32, 'M', 175, 75.0)
ON CONFLICT DO NOTHING;

INSERT INTO exercises (nome_esercizio, tipo_esercizio, descrizione)
VALUES
  ('Panca piana', 'forza', 'Esercizio multiarticolare per il petto'),
  ('Squat', 'forza', 'Esercizio multiarticolare per gli arti inferiori')
ON CONFLICT DO NOTHING;

INSERT INTO training_status (athlete_id, giorno, valore)
VALUES
  (1, '2024-06-01', 85)
ON CONFLICT (athlete_id, giorno) DO UPDATE SET valore = EXCLUDED.valore;

INSERT INTO jobs_in_coda (athlete_id)
VALUES
  (1),
  (2)
ON CONFLICT (athlete_id) DO NOTHING;

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
