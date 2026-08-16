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

-- TRAINING_STATUS_RESULTS: output Job 1 (multi-window cardio analysis)
CREATE TABLE IF NOT EXISTS training_status_results (
  result_id SERIAL PRIMARY KEY,
  athlete_id INT NOT NULL REFERENCES athletes(athlete_id) ON DELETE CASCADE,
  result_date DATE NOT NULL,
  acwr DECIMAL(5, 2),
  hrv DECIMAL(5, 3),
  readiness INT,
  injury_risk_pct DECIMAL(5, 2),
  status VARCHAR(20) CHECK (status IN ('green', 'amber', 'red')),
  trimp_3d DECIMAL(10, 2),
  trimp_7d DECIMAL(10, 2),
  trimp_28d DECIMAL(10, 2),
  trimp_42d DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- FEATURE_IMPORTANCE_RESULTS: output Job 2 (exercise correlation + ML importance)
CREATE TABLE IF NOT EXISTS feature_importance_results (
  result_id SERIAL PRIMARY KEY,
  feature_name VARCHAR(100) NOT NULL,
  importance_score DECIMAL(5, 4),
  ranking INT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- EXERCISE_CORRELATIONS: output Job 2 (pairwise exercise correlations)
CREATE TABLE IF NOT EXISTS exercise_correlations (
  corr_id SERIAL PRIMARY KEY,
  exercise1_id INT,
  exercise2_id INT,
  correlation_coefficient DECIMAL(5, 4),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- EXERCISE_VOLUMES_CLUSTERS: output Job 3 (volume aggregation + K-Means + anomaly detection)
CREATE TABLE IF NOT EXISTS exercise_volumes_clusters (
  result_id SERIAL PRIMARY KEY,
  athlete_id INT NOT NULL REFERENCES athletes(athlete_id) ON DELETE CASCADE,
  exercise_type VARCHAR(50),
  week_id VARCHAR(20),
  cluster_id INT,
  is_anomaly BOOLEAN DEFAULT FALSE,
  anomaly_reason VARCHAR(200),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WEEKLY_CARDIO_AGGREGATES: output of Job 1 aggregation (pre-computed for Job 3)
CREATE TABLE IF NOT EXISTS weekly_cardio_aggregates (
  agg_id SERIAL PRIMARY KEY,
  athlete_id INT NOT NULL REFERENCES athletes(athlete_id) ON DELETE CASCADE,
  week_id VARCHAR(20) NOT NULL,
  total_trimp DECIMAL(10, 2),
  total_km_running DECIMAL(8, 2),
  avg_hr DECIMAL(6, 2),
  max_hr INT,
  avg_hrv DECIMAL(6, 3),
  avg_speed DECIMAL(6, 2),
  session_count INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_weekly_cardio UNIQUE (athlete_id, week_id)
);

SELECT create_reference_table('athletes');
SELECT create_reference_table('exercises');
SELECT create_reference_table('smartwatch_sessions');
SELECT create_reference_table('injury_history');
SELECT create_reference_table('training_status_results');
SELECT create_reference_table('feature_importance_results');
SELECT create_reference_table('exercise_correlations');
SELECT create_reference_table('exercise_volumes_clusters');
SELECT create_reference_table('weekly_cardio_aggregates');
SELECT create_distributed_table('training_status', 'athlete_id');

INSERT INTO athletes (nome, cognome, eta, sesso, altezza_cm, peso_kg)
SELECT *
FROM (
  VALUES
    ('Marco', 'Rossi', 28, 'M', 182, 80.5),
    ('Giulia', 'Bianchi', 25, 'F', 168, 62.3),
    ('Alessandro', 'Verdi', 32, 'M', 175, 75.0)
) AS seed(nome, cognome, eta, sesso, altezza_cm, peso_kg)
WHERE NOT EXISTS (
  SELECT 1
  FROM athletes a
  WHERE a.nome = seed.nome
    AND a.cognome = seed.cognome
    AND a.eta = seed.eta
    AND a.sesso = seed.sesso
    AND a.altezza_cm = seed.altezza_cm
    AND a.peso_kg = seed.peso_kg
);

INSERT INTO exercises (nome_esercizio, tipo_esercizio, descrizione)
SELECT *
FROM (
  VALUES
    ('Panca piana', 'forza', 'Esercizio multiarticolare per il petto'),
    ('Squat', 'forza', 'Esercizio multiarticolare per gli arti inferiori')
) AS seed(nome_esercizio, tipo_esercizio, descrizione)
WHERE NOT EXISTS (
  SELECT 1
  FROM exercises e
  WHERE e.nome_esercizio = seed.nome_esercizio
    AND e.tipo_esercizio = seed.tipo_esercizio
    AND COALESCE(e.descrizione, '') = COALESCE(seed.descrizione, '')
);

INSERT INTO training_status (athlete_id, giorno, valore)
VALUES
  (1, '2024-06-01', 85)
ON CONFLICT (athlete_id, giorno) DO UPDATE SET valore = EXCLUDED.valore;

INSERT INTO injury_history (athlete_id, injury_date, injury_type, severity, recovery_days, pre_injury_acwr, pre_injury_hrv, pre_injury_load, notes)
SELECT *
FROM (
  VALUES
    (1, '2024-04-15', 'Sprained ankle', 'moderate', 14, 1.8, 45.2, 350, 'Training overload during sprint work'),
    (2, '2024-05-02', 'Lower back strain', 'light', 7, 2.1, 38.5, 380, 'Poor form on heavy squats'),
    (1, '2024-02-20', 'Knee pain', 'light', 10, 1.5, 42.1, 320, 'Excessive plyometric volume')
) AS seed(athlete_id, injury_date, injury_type, severity, recovery_days, pre_injury_acwr, pre_injury_hrv, pre_injury_load, notes)
WHERE NOT EXISTS (
  SELECT 1
  FROM injury_history ih
  WHERE ih.athlete_id = seed.athlete_id
    AND ih.injury_date = seed.injury_date
    AND ih.injury_type = seed.injury_type
);

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
