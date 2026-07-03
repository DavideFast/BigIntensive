import pg from "pg";

const DEFAULT_ATHLETES = Number(process.env.SEED_ATHLETES || 20);
const DEFAULT_DAYS = Number(process.env.SEED_DAYS || 45);
const RESET = String(process.env.SEED_RESET || "false").toLowerCase() === "true";

const citusConfig = {
  user: process.env.CITUS_POSTGRES_USER || "postgres",
  password: process.env.CITUS_POSTGRES_PASSWORD || "postgres",
  host: process.env.CITUS_HOST || "localhost",
  port: Number(process.env.CITUS_PORT || 5432),
  database: process.env.CITUS_POSTGRES_DB || "bigintensive",
};

const clickhouseConfig = {
  host: process.env.CLICKHOUSE_HOST || "localhost",
  port: Number(process.env.CLICKHOUSE_PORT || 8123),
  user: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "",
  database: process.env.CLICKHOUSE_DB || "bigintensive",
};

const firstNames = ["Marco", "Luca", "Giulia", "Sara", "Alessandro", "Francesca", "Davide", "Elena", "Matteo", "Chiara"];
const lastNames = ["Rossi", "Bianchi", "Verdi", "Russo", "Ferrari", "Esposito", "Romano", "Gallo", "Costa", "Fontana"];

const exerciseCatalog = [
  { nome_esercizio: "Panca piana", descrizione: "Spinta orizzontale bilanciere" },
  { nome_esercizio: "Squat", descrizione: "Spinta arti inferiori" },
  { nome_esercizio: "Stacco da terra", descrizione: "Catena posteriore" },
  { nome_esercizio: "Military press", descrizione: "Spinta verticale" },
  { nome_esercizio: "Rematore", descrizione: "Trazione orizzontale" },
  { nome_esercizio: "Affondi", descrizione: "Lavoro unilaterale gambe" },
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max, precision = 2) {
  const value = min + Math.random() * (max - min);
  return Number(value.toFixed(precision));
}

function randomFrom(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function generateAthletes(count) {
  const athletes = [];
  for (let i = 0; i < count; i += 1) {
    athletes.push({
      nome: randomFrom(firstNames),
      cognome: randomFrom(lastNames),
      eta: randInt(18, 42),
      sesso: randomFrom(["M", "F"]),
      altezza_cm: randInt(160, 195),
      peso_kg: randFloat(58, 98, 1),
    });
  }
  return athletes;
}

function dateDaysAgo(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function toDateTime(date, secondsOffset = 0) {
  const t = new Date(date.getTime() + secondsOffset * 1000);
  return t.toISOString().slice(0, 19).replace("T", " ");
}

function buildWorkoutData(athleteIds, exerciseIds, days) {
  const workouts = [];
  const workoutExercises = [];
  const trainingStatus = [];
  const exerciseMetrics = [];
  const cardioSamples = [];
  const clickhouseWorkoutMetrics = [];
  const clickhouseSensorData = [];

  let workoutIdCursor = 1;

  for (const athleteId of athleteIds) {
    for (let day = 0; day < days; day += 1) {
      const date = dateDaysAgo(day);
      const dateOnly = toDateOnly(date);

      trainingStatus.push({
        athlete_id: athleteId,
        giorno: dateOnly,
        valore: randInt(55, 95),
        note: day % 7 === 0 ? "scarico" : null,
      });

      const workoutCount = day % 6 === 0 ? 0 : randInt(1, 2);
      for (let w = 0; w < workoutCount; w += 1) {
        const workoutId = workoutIdCursor++;
        const durata = randInt(35, 90);

        workouts.push({
          athlete_id: athleteId,
          workout_id: workoutId,
          nome_allenamento: w === 0 ? "Sessione forza" : "Sessione tecnica",
          descrizione: "Workout generato automaticamente",
          durata_min: durata,
          workout_date: dateOnly,
        });

        const selectedExercises = [...exerciseIds].sort(() => Math.random() - 0.5).slice(0, randInt(3, 5));

        selectedExercises.forEach((exerciseId, index) => {
          const risultato = randFloat(35, 140, 1);
          const serie = randInt(3, 5);
          const rip = randInt(5, 12);

          workoutExercises.push({
            athlete_id: athleteId,
            workout_id: workoutId,
            exercise_id: exerciseId,
            ordine: index + 1,
            serie,
            ripetizioni: rip,
            tempo_riposo_sec: randInt(60, 150),
            risultato,
          });

          exerciseMetrics.push({
            athlete_id: athleteId,
            esercizio: `exercise_${exerciseId}`,
            valore_salto: randFloat(22, 58, 2),
            rsi: randFloat(1.4, 3.2, 4),
            differenza_bilaterale: randFloat(0.5, 14.0, 2),
            potenza_sviluppata: randFloat(900, 3100, 2),
            created_at: toDateTime(date, randInt(0, 3600)),
          });

          clickhouseWorkoutMetrics.push({
            athlete_id: athleteId,
            workout_id: workoutId,
            timestamp: toDateTime(date, randInt(0, 3000)),
            power: randFloat(120, 420, 2),
            heart_rate: randInt(110, 186),
            cadence: randInt(68, 102),
            speed: randFloat(8.5, 17.5, 2),
            distance: randFloat(0.2, 4.0, 2),
          });

          clickhouseSensorData.push({
            sensor_id: exerciseId,
            timestamp: toDateTime(date, randInt(0, 3600)),
            value: randFloat(0.5, 100.0, 3),
            sensor_type: randomFrom(["force_plate", "imu", "heart_rate", "cadence"]),
          });
        });

        const sampleEverySec = 30;
        for (let second = 0; second <= 10 * 60; second += sampleEverySec) {
          cardioSamples.push({
            athlete_id: athleteId,
            heart_rate_bpm: randFloat(110, 182, 1),
            cadence_spm: randFloat(150, 186, 1),
            speed_kmh: randFloat(8.5, 16.5, 2),
            altitude_m: randFloat(95, 160, 2),
            timestamp: toDateTime(date, second),
          });
        }

        clickhouseWorkoutMetrics.push({
          athlete_id: athleteId,
          workout_id: workoutId,
          timestamp: toDateTime(date, 0),
          power: randFloat(110, 350, 2),
          heart_rate: randInt(105, 176),
          cadence: randInt(65, 96),
          speed: randFloat(8.0, 16.0, 2),
          distance: randFloat(1.0, 6.0, 2),
        });
      }
    }
  }

  return { workouts, workoutExercises, trainingStatus, exerciseMetrics, cardioSamples, clickhouseWorkoutMetrics, clickhouseSensorData };
}

async function ensureCitusSchema(client) {
  await client.query(`
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

    CREATE TABLE IF NOT EXISTS workouts (
      workout_id BIGINT NOT NULL,
      athlete_id INT NOT NULL REFERENCES athletes(athlete_id),
      nome_allenamento VARCHAR(150) NOT NULL,
      descrizione TEXT,
      durata_min INT NOT NULL CHECK (durata_min > 0 AND durata_min <= 600),
      workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (athlete_id, workout_id)
    );

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
      CONSTRAINT uq_workout_exercises_order UNIQUE (athlete_id, workout_id, ordine)
    );

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
  `);
}

async function resetCitus(client) {
  await client.query(`
    TRUNCATE TABLE
      cardio_endurance_samples,
      exercise_metrics,
      workout_exercises,
      workouts,
      training_status,
      exercises,
      athletes
    RESTART IDENTITY CASCADE;
  `);
}

async function seedCitus(client, athletesToCreate, days) {
  await ensureCitusSchema(client);
  if (RESET) {
    await resetCitus(client);
  }

  const insertedAthletes = [];
  for (const athlete of athletesToCreate) {
    const result = await client.query(
      `INSERT INTO athletes (nome, cognome, eta, sesso, altezza_cm, peso_kg)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING athlete_id`,
      [athlete.nome, athlete.cognome, athlete.eta, athlete.sesso, athlete.altezza_cm, athlete.peso_kg],
    );
    insertedAthletes.push(result.rows[0].athlete_id);
  }

  const insertedExercises = [];
  for (const ex of exerciseCatalog) {
    const result = await client.query(
      `INSERT INTO exercises (nome_esercizio, descrizione)
       VALUES ($1, $2)
       RETURNING exercise_id`,
      [ex.nome_esercizio, ex.descrizione],
    );
    insertedExercises.push(result.rows[0].exercise_id);
  }

  const data = buildWorkoutData(insertedAthletes, insertedExercises, days);

  for (const w of data.workouts) {
    await client.query(
      `INSERT INTO workouts (athlete_id, workout_id, nome_allenamento, descrizione, durata_min, workout_date)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [w.athlete_id, w.workout_id, w.nome_allenamento, w.descrizione, w.durata_min, w.workout_date],
    );
  }

  for (const we of data.workoutExercises) {
    await client.query(
      `INSERT INTO workout_exercises (athlete_id, workout_id, exercise_id, ordine, serie, ripetizioni, tempo_riposo_sec, risultato)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [we.athlete_id, we.workout_id, we.exercise_id, we.ordine, we.serie, we.ripetizioni, we.tempo_riposo_sec, we.risultato],
    );
  }

  for (const ts of data.trainingStatus) {
    await client.query(
      `INSERT INTO training_status (athlete_id, giorno, valore, note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (athlete_id, giorno) DO UPDATE SET valore = EXCLUDED.valore, note = EXCLUDED.note`,
      [ts.athlete_id, ts.giorno, ts.valore, ts.note],
    );
  }

  for (const m of data.exerciseMetrics) {
    await client.query(
      `INSERT INTO exercise_metrics (athlete_id, esercizio, valore_salto, rsi, differenza_bilaterale, potenza_sviluppata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [m.athlete_id, m.esercizio, m.valore_salto, m.rsi, m.differenza_bilaterale, m.potenza_sviluppata, m.created_at],
    );
  }

  for (const c of data.cardioSamples) {
    await client.query(
      `INSERT INTO cardio_endurance_samples (athlete_id, heart_rate_bpm, cadence_spm, speed_kmh, altitude_m, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [c.athlete_id, c.heart_rate_bpm, c.cadence_spm, c.speed_kmh, c.altitude_m, c.timestamp],
    );
  }

  return {
    athletes: insertedAthletes.length,
    exercises: insertedExercises.length,
    workouts: data.workouts.length,
    workoutExercises: data.workoutExercises.length,
    trainingStatus: data.trainingStatus.length,
    exerciseMetrics: data.exerciseMetrics.length,
    cardioSamples: data.cardioSamples.length,
    clickhouseWorkoutMetrics: data.clickhouseWorkoutMetrics,
    clickhouseSensorData: data.clickhouseSensorData,
  };
}

function clickhouseHeaders() {
  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
  };

  if (clickhouseConfig.user) {
    const auth = Buffer.from(`${clickhouseConfig.user}:${clickhouseConfig.password || ""}`).toString("base64");
    headers.Authorization = `Basic ${auth}`;
  }

  return headers;
}

async function clickhouseQuery(sql, body = "") {
  const url = `http://${clickhouseConfig.host}:${clickhouseConfig.port}/?database=${encodeURIComponent(clickhouseConfig.database)}&query=${encodeURIComponent(sql)}`;
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: clickhouseHeaders(),
    body: body || undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ClickHouse query failed: ${response.status} ${text}`);
  }

  return response.text();
}

async function ensureClickhouseSchema() {
  await clickhouseQuery(`CREATE DATABASE IF NOT EXISTS ${clickhouseConfig.database}`);
  await clickhouseQuery(`
    CREATE TABLE IF NOT EXISTS ${clickhouseConfig.database}.workout_metrics (
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
    PARTITION BY toYYYYMM(timestamp)
  `);
  await clickhouseQuery(`
    CREATE TABLE IF NOT EXISTS ${clickhouseConfig.database}.sensor_data (
      sensor_id UInt32,
      timestamp DateTime,
      value Float32,
      sensor_type String
    ) ENGINE = MergeTree
    ORDER BY (timestamp, sensor_id)
    PARTITION BY toYYYYMM(timestamp)
  `);
}

async function resetClickhouse() {
  await clickhouseQuery(`TRUNCATE TABLE ${clickhouseConfig.database}.workout_metrics`);
  await clickhouseQuery(`TRUNCATE TABLE ${clickhouseConfig.database}.sensor_data`);
}

async function seedClickhouse(workoutMetricsRows, sensorRows) {
  await ensureClickhouseSchema();
  if (RESET) {
    await resetClickhouse();
  }

  let insertedWorkoutMetrics = 0;
  let insertedSensorData = 0;

  if (workoutMetricsRows.length) {
    const workoutMetricsPayload = workoutMetricsRows
      .map((r) =>
        JSON.stringify({
          athlete_id: r.athlete_id,
          workout_id: r.workout_id,
          timestamp: r.timestamp,
          power: r.power,
          heart_rate: r.heart_rate,
          cadence: r.cadence,
          speed: r.speed,
          distance: r.distance,
        }),
      )
      .join("\n");

    await clickhouseQuery(`INSERT INTO ${clickhouseConfig.database}.workout_metrics FORMAT JSONEachRow`, workoutMetricsPayload);
    insertedWorkoutMetrics = workoutMetricsRows.length;
  }

  if (sensorRows.length) {
    const sensorPayload = sensorRows
      .map((r) =>
        JSON.stringify({
          sensor_id: r.sensor_id,
          timestamp: r.timestamp,
          value: r.value,
          sensor_type: r.sensor_type,
        }),
      )
      .join("\n");

    await clickhouseQuery(`INSERT INTO ${clickhouseConfig.database}.sensor_data FORMAT JSONEachRow`, sensorPayload);
    insertedSensorData = sensorRows.length;
  }

  return {
    workoutMetrics: insertedWorkoutMetrics,
    sensorData: insertedSensorData,
  };
}

async function main() {
  const pool = new pg.Pool(citusConfig);

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const summary = await seedCitus(client, generateAthletes(DEFAULT_ATHLETES), DEFAULT_DAYS);
      await client.query("COMMIT");

      const clickhouseInserted = await seedClickhouse(summary.clickhouseWorkoutMetrics, summary.clickhouseSensorData);

      console.log("Seed completato con successo");
      console.log({
        citus: {
          athletes: summary.athletes,
          exercises: summary.exercises,
          workouts: summary.workouts,
          workoutExercises: summary.workoutExercises,
          trainingStatus: summary.trainingStatus,
          exerciseMetrics: summary.exerciseMetrics,
          cardioSamples: summary.cardioSamples,
        },
        clickhouse: {
          workoutMetricsRows: clickhouseInserted.workoutMetrics,
          sensorDataRows: clickhouseInserted.sensorData,
        },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Seed fallito:", err.message);
  process.exit(1);
});
