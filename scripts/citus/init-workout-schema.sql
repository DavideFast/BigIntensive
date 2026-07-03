-- Workout domain schema aligned with tipo_dati.js
-- Uses athlete_id as Citus distribution key for write-heavy tables.

CREATE TABLE IF NOT EXISTS exercises (
  exercise_id SERIAL PRIMARY KEY,
  nome_esercizio VARCHAR(150) NOT NULL,
  descrizione TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Replicate exercises on all workers to simplify joins.
SELECT create_reference_table('exercises');

CREATE TABLE IF NOT EXISTS workouts (
  workout_id BIGSERIAL,
  athlete_id INT NOT NULL REFERENCES athletes(athlete_id),
  nome_allenamento VARCHAR(150) NOT NULL,
  descrizione TEXT,
  durata_min INT NOT NULL CHECK (durata_min > 0 AND durata_min <= 600),
  workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (athlete_id, workout_id)
);

SELECT create_distributed_table('workouts', 'athlete_id');

CREATE TABLE IF NOT EXISTS workout_exercises (
  workout_exercise_id BIGSERIAL,
  athlete_id INT NOT NULL,
  workout_id BIGINT NOT NULL,
  exercise_id INT NOT NULL REFERENCES exercises(exercise_id),
  ordine SMALLINT NOT NULL CHECK (ordine > 0),
  serie SMALLINT NOT NULL CHECK (serie > 0),
  ripetizioni SMALLINT NOT NULL CHECK (ripetizioni > 0),
  tempo_riposo_sec SMALLINT CHECK (tempo_riposo_sec >= 0),
  risultato DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (athlete_id, workout_exercise_id),
  CONSTRAINT fk_workout_exercises_workout
    FOREIGN KEY (athlete_id, workout_id)
    REFERENCES workouts(athlete_id, workout_id)
    ON DELETE CASCADE,
  CONSTRAINT uq_workout_exercises_order
    UNIQUE (athlete_id, workout_id, ordine)
);

SELECT create_distributed_table('workout_exercises', 'athlete_id');

CREATE TABLE IF NOT EXISTS training_status (
  status_id BIGSERIAL,
  athlete_id INT NOT NULL REFERENCES athletes(athlete_id),
  giorno DATE NOT NULL,
  valore SMALLINT NOT NULL CHECK (valore >= 0 AND valore <= 100),
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (athlete_id, status_id),
  CONSTRAINT uq_training_status_day UNIQUE (athlete_id, giorno)
);

SELECT create_distributed_table('training_status', 'athlete_id');

CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts (athlete_id, workout_date DESC);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout ON workout_exercises (athlete_id, workout_id);
CREATE INDEX IF NOT EXISTS idx_training_status_day ON training_status (athlete_id, giorno DESC);
