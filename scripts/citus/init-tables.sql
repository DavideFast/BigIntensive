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

-- Force plate samples table (distributed table for time-series data)
CREATE TABLE IF NOT EXISTS force_plate_samples (
  sample_id BIGSERIAL,
  athlete_id INT NOT NULL REFERENCES athletes(athlete_id),
  exercise VARCHAR(50) NOT NULL,
  left_foot_force_newtons DECIMAL(10, 2),
  right_foot_force_newtons DECIMAL(10, 2),
  total_force_newtons DECIMAL(10, 2),
  timestamp TIMESTAMP NOT NULL,
  sample_index INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (athlete_id, timestamp, sample_id)
) PARTITION BY RANGE (timestamp);

-- Set force_plate_samples as distributed table with athlete_id as distribution column
SELECT create_distributed_table('force_plate_samples', 'athlete_id');

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
