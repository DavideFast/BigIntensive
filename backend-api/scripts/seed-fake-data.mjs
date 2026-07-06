import pg from "pg";

const DEFAULT_ATHLETES = Number(process.env.SEED_ATHLETES || 100);
const DEFAULT_EXERCISES = Number(process.env.SEED_EXERCISES || 100);
const DEFAULT_DAYS = Number(process.env.SEED_DAYS || 14);
const RESET = String(process.env.SEED_RESET || "false").toLowerCase() === "true";
const SEED_SMARTWATCH_SESSIONS =
  String(process.env.SEED_SMARTWATCH_SESSIONS || "false").toLowerCase() === "true";

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

const firstNames = [
  "Marco",
  "Luca",
  "Giulia",
  "Sara",
  "Alessandro",
  "Francesca",
  "Davide",
  "Elena",
  "Matteo",
  "Chiara",
];
const lastNames = [
  "Rossi",
  "Bianchi",
  "Verdi",
  "Russo",
  "Ferrari",
  "Esposito",
  "Romano",
  "Gallo",
  "Costa",
  "Fontana",
];

const baseExerciseCatalog = [
  {
    nome_esercizio: "Panca piana",
    tipo_esercizio: "forza",
    descrizione: "Spinta orizzontale bilanciere",
  },
  { nome_esercizio: "Squat", tipo_esercizio: "forza", descrizione: "Spinta arti inferiori" },
  { nome_esercizio: "Stacco da terra", tipo_esercizio: "forza", descrizione: "Catena posteriore" },
  { nome_esercizio: "Military press", tipo_esercizio: "forza", descrizione: "Spinta verticale" },
  { nome_esercizio: "Rematore", tipo_esercizio: "forza", descrizione: "Trazione orizzontale" },
  {
    nome_esercizio: "Affondi",
    tipo_esercizio: "mobilità",
    descrizione: "Lavoro unilaterale gambe",
  },
];

function generateExerciseCatalog(count) {
  const catalog = [...baseExerciseCatalog];
  const types = ["forza", "endurance", "mobilità"];

  for (let i = catalog.length + 1; i <= count; i += 1) {
    const type = types[(i - 1) % types.length];
    catalog.push({
      nome_esercizio: `Esercizio ${String(i).padStart(3, "0")}`,
      tipo_esercizio: type,
      descrizione: `Esercizio generato automaticamente (${type})`,
    });
  }

  return catalog.slice(0, count);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max, precision = 2) {
  const value = min + Math.random() * (max - min);
  return Number(value.toFixed(precision));
}

function randNormal(mean = 0, stdDev = 1) {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
      profile: {
        baselinePower: randFloat(170, 310, 2),
        baselineHr: randFloat(132, 165, 2),
        adaptability: randFloat(0.85, 1.2, 3),
        fatigueSensitivity: randFloat(0.8, 1.2, 3),
        recoveryQuality: randFloat(0.85, 1.15, 3),
      },
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

function buildAthleteProfiles(athleteIds, athletesSeedData = []) {
  const profiles = new Map();
  athleteIds.forEach((athleteId, index) => {
    const seedProfile = athletesSeedData[index]?.profile;
    const profile = seedProfile || {
      baselinePower: randFloat(170, 310, 2),
      baselineHr: randFloat(132, 165, 2),
      adaptability: randFloat(0.85, 1.2, 3),
      fatigueSensitivity: randFloat(0.8, 1.2, 3),
      recoveryQuality: randFloat(0.85, 1.15, 3),
    };
    profiles.set(athleteId, profile);
  });
  return profiles;
}

function computeDayState(day, totalDays, profile) {
  const trainingProgress = totalDays > 1 ? (totalDays - day - 1) / (totalDays - 1) : 0;
  const weeklyWave = Math.sin((day / 7) * 2 * Math.PI);
  const blockWave = Math.sin((day / 21) * 2 * Math.PI);
  const fatigue = clamp(
    (1 - profile.recoveryQuality) * 16 + (1 - weeklyWave) * profile.fatigueSensitivity * 10,
    0,
    28,
  );

  const readinessRaw =
    65 +
    trainingProgress * 22 * profile.adaptability +
    weeklyWave * 6 +
    blockWave * 4 -
    fatigue +
    randNormal(0, 3.2);

  return {
    trainingProgress,
    fatigue,
    readiness: clamp(readinessRaw, 38, 98),
    deloadDay: day % 7 === 0,
  };
}

function buildWorkoutData(
  athleteIds,
  exerciseIds,
  days,
  athletesSeedData = [],
  includeSmartwatchSessions = false,
) {
  const workouts = [];
  const workoutExercises = [];
  const trainingStatus = [];
  const smartwatchSessions = [];
  const cardioSamples = [];
  const clickhouseEnduranceSessions = [];
  const athleteProfiles = buildAthleteProfiles(athleteIds, athletesSeedData);

  let workoutIdCursor = 1;

  for (const athleteId of athleteIds) {
    const profile = athleteProfiles.get(athleteId);
    for (let day = 0; day < days; day += 1) {
      const date = dateDaysAgo(day);
      const dateOnly = toDateOnly(date);
      const dayState = computeDayState(day, days, profile);

      trainingStatus.push({
        athlete_id: athleteId,
        giorno: dateOnly,
        valore: Math.round(dayState.readiness),
      });

      const workoutCount = day % 6 === 0 ? 0 : dayState.readiness < 52 ? 1 : randInt(1, 2);
      for (let w = 0; w < workoutCount; w += 1) {
        const workoutId = workoutIdCursor++;
        const durata = Math.round(
          clamp(40 + dayState.readiness * 0.38 + randNormal(0, 8), 30, 100),
        );

        workouts.push({
          athlete_id: athleteId,
          workout_id: workoutId,
          nome_allenamento: w === 0 ? "Sessione forza" : "Sessione tecnica",
          descrizione: "Workout generato automaticamente",
          durata_min: durata,
          workout_date: dateOnly,
          timestamp: toDateTime(date, randInt(0, 3000)),
        });

        const selectedExercises = [...exerciseIds]
          .sort(() => Math.random() - 0.5)
          .slice(0, randInt(3, 5));

        selectedExercises.forEach((exerciseId, index) => {
          const exerciseFactor = 0.9 + (exerciseId % 4) * 0.08;
          const performance =
            profile.baselinePower *
            exerciseFactor *
            (0.72 + dayState.readiness / 155 + dayState.trainingProgress * 0.12);
          const risultato = Number(clamp(performance + randNormal(0, 6), 30, 185).toFixed(1));
          const serie = randInt(3, 5);
          const rip = randInt(5, 12);
          const jumpValue = clamp(20 + risultato * 0.2 + randNormal(0, 2.8), 18, 65);
          const rsiValue = clamp(1.1 + jumpValue / 27 + randNormal(0, 0.14), 1.0, 3.8);
          const bilateralDiff = clamp(
            13 - dayState.trainingProgress * 7 + randNormal(0, 1.4),
            0.3,
            16.0,
          );
          const generatedPower = clamp(750 + risultato * 16 + randNormal(0, 120), 700, 3600);

          workoutExercises.push({
            athlete_id: athleteId,
            workout_id: workoutId,
            exercise_id: exerciseId,
            ordine: index + 1,
            serie,
            ripetizioni: rip,
            tempo_riposo_sec: randInt(60, 150),
            risultato,
            timestamp: toDateTime(date, randInt(0, 3600)),
          });
        });

        const sampleEverySec = 30;
        for (let second = 0; second <= 10 * 60; second += sampleEverySec) {
          const effortRatio = second / (10 * 60);
          const instantHr = clamp(
            profile.baselineHr +
              effortRatio * 22 +
              (100 - dayState.readiness) * 0.35 +
              randNormal(0, 2),
            98,
            196,
          );
          const instantCadence = clamp(
            148 + effortRatio * 12 + dayState.readiness * 0.1 + randNormal(0, 1.5),
            140,
            192,
          );
          const instantSpeed = clamp(
            8.0 + effortRatio * 3.8 + dayState.readiness * 0.03 + randNormal(0, 0.25),
            7.0,
            18.5,
          );
          cardioSamples.push({
            athlete_id: athleteId,
            sessione_id: workoutId,
            secondo: second,
            heart_rate_bpm: Number(instantHr.toFixed(1)),
            cadence_spm: Number(instantCadence.toFixed(1)),
            speed_kmh: Number(instantSpeed.toFixed(2)),
            altitude_m: Number(clamp(102 + randNormal(0, 4), 90, 180).toFixed(2)),
            temperature_c: Number(clamp(19.5 + randNormal(0, 1.3), 14, 34).toFixed(2)),
            timestamp: toDateTime(date, second),
          });
        }

        clickhouseEnduranceSessions.push({
          atleta_id: athleteId,
          sessione_id: workoutId,
          commento:
            dayState.readiness >= 70 ? "Progressione regolare" : "Sessione di recupero controllato",
          ts: toDateTime(date, 0),
        });

        if (includeSmartwatchSessions) {
          const endedAt = randInt(0, 10) > 2 ? toDateTime(date, 10 * 60 + randInt(15, 90)) : null;
          smartwatchSessions.push({
            athlete_id: athleteId,
            topic: "heart-rate-events",
            status: endedAt ? "ended" : "active",
            samples_sent: Math.floor((10 * 60) / sampleEverySec) + 1,
            started_at: toDateTime(date, 0),
            ended_at: endedAt,
            end_reason: endedAt
              ? randomFrom(["session-completed", "manual-stop", "target-reached"])
              : null,
          });
        }
      }
    }
  }

  return {
    workouts,
    workoutExercises,
    trainingStatus,
    smartwatchSessions,
    cardioSamples,
    clickhouseEnduranceSessions,
  };
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
  `);

  await client.query(`
    ALTER TABLE exercises
    ADD COLUMN IF NOT EXISTS tipo_esercizio VARCHAR(50)
    CHECK (tipo_esercizio IN ('forza', 'endurance', 'mobilità'));
  `);

}

async function resetCitus(client) {
  await client.query(`
    TRUNCATE TABLE
      training_status,
      smartwatch_sessions,
      exercises,
      athletes
    RESTART IDENTITY CASCADE;
  `);
}

async function seedCitus(client, athletesToCreate, exercisesToCreate, days) {
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
      [
        athlete.nome,
        athlete.cognome,
        athlete.eta,
        athlete.sesso,
        athlete.altezza_cm,
        athlete.peso_kg,
      ],
    );
    insertedAthletes.push(result.rows[0].athlete_id);
  }

  const insertedExercises = [];
  for (const ex of exercisesToCreate) {
    const result = await client.query(
      `INSERT INTO exercises (nome_esercizio, tipo_esercizio, descrizione)
       VALUES ($1, $2, $3)
       RETURNING exercise_id`,
      [ex.nome_esercizio, ex.tipo_esercizio, ex.descrizione],
    );
    insertedExercises.push(result.rows[0].exercise_id);
  }

  const data = buildWorkoutData(
    insertedAthletes,
    insertedExercises,
    days,
    athletesToCreate,
    SEED_SMARTWATCH_SESSIONS,
  );

  for (const ts of data.trainingStatus) {
    await client.query(
      `INSERT INTO training_status (athlete_id, giorno, valore)
       VALUES ($1, $2, $3)
       ON CONFLICT (athlete_id, giorno) DO UPDATE SET valore = EXCLUDED.valore`,
      [ts.athlete_id, ts.giorno, ts.valore],
    );
  }

  if (SEED_SMARTWATCH_SESSIONS) {
    for (const session of data.smartwatchSessions) {
      await client.query(
        `INSERT INTO smartwatch_sessions (athlete_id, topic, status, samples_sent, started_at, ended_at, end_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          session.athlete_id,
          session.topic,
          session.status,
          session.samples_sent,
          session.started_at,
          session.ended_at,
          session.end_reason,
        ],
      );
    }
  }

  return {
    athletes: insertedAthletes.length,
    exercises: insertedExercises.length,
    trainingStatus: data.trainingStatus.length,
    smartwatchSessions: data.smartwatchSessions.length,
    clickhouseAllenamenti: data.workouts,
    clickhouseAllenamentoDettagli: data.workoutExercises,
    clickhouseEnduranceSessions: data.clickhouseEnduranceSessions,
    clickhouseEnduranceCampioni: data.cardioSamples,
  };
}

function clickhouseHeaders() {
  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
  };

  if (clickhouseConfig.user) {
    const auth = Buffer.from(
      `${clickhouseConfig.user}:${clickhouseConfig.password || ""}`,
    ).toString("base64");
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

async function assertClickhouseSchemaExists() {
  const dbExistsRaw = await clickhouseQuery(`EXISTS DATABASE ${clickhouseConfig.database}`);
  const dbExists = dbExistsRaw.trim() === "1";
  if (!dbExists) {
    throw new Error(`ClickHouse schema mancante: database ${clickhouseConfig.database} non esiste`);
  }

  const allenamentiExistsRaw = await clickhouseQuery(
    `EXISTS TABLE ${clickhouseConfig.database}.allenamenti`,
  );
  if (allenamentiExistsRaw.trim() !== "1") {
    throw new Error(
      `ClickHouse schema mancante: tabella ${clickhouseConfig.database}.allenamenti non esiste`,
    );
  }

  const dettagliExistsRaw = await clickhouseQuery(
    `EXISTS TABLE ${clickhouseConfig.database}.allenamento_dettagli`,
  );
  if (dettagliExistsRaw.trim() !== "1") {
    throw new Error(
      `ClickHouse schema mancante: tabella ${clickhouseConfig.database}.allenamento_dettagli non esiste`,
    );
  }

  const enduranceSessioniExistsRaw = await clickhouseQuery(
    `EXISTS TABLE ${clickhouseConfig.database}.corsa_endurance_sessioni`,
  );
  if (enduranceSessioniExistsRaw.trim() !== "1") {
    throw new Error(
      `ClickHouse schema mancante: tabella ${clickhouseConfig.database}.corsa_endurance_sessioni non esiste`,
    );
  }

  const enduranceCampioniExistsRaw = await clickhouseQuery(
    `EXISTS TABLE ${clickhouseConfig.database}.corsa_endurance_campioni`,
  );
  if (enduranceCampioniExistsRaw.trim() !== "1") {
    throw new Error(
      `ClickHouse schema mancante: tabella ${clickhouseConfig.database}.corsa_endurance_campioni non esiste`,
    );
  }
}

async function resetClickhouse() {
  await clickhouseQuery(`TRUNCATE TABLE ${clickhouseConfig.database}.corsa_endurance_campioni`);
  await clickhouseQuery(`TRUNCATE TABLE ${clickhouseConfig.database}.corsa_endurance_sessioni`);
  await clickhouseQuery(`TRUNCATE TABLE ${clickhouseConfig.database}.allenamento_dettagli`);
  await clickhouseQuery(`TRUNCATE TABLE ${clickhouseConfig.database}.allenamenti`);
}

async function seedClickhouse(
  allenamentiRows,
  allenamentoDettagliRows,
  enduranceSessioniRows,
  enduranceCampioniRows,
) {
  await assertClickhouseSchemaExists();
  if (RESET) {
    await resetClickhouse();
  }

  let insertedAllenamenti = 0;
  let insertedAllenamentoDettagli = 0;
  let insertedEnduranceSessioni = 0;
  let insertedEnduranceCampioni = 0;

  if (allenamentiRows.length) {
    const allenamentiPayload = allenamentiRows
      .map((r) =>
        JSON.stringify({
          allenamento_id: r.workout_id,
          atleta_id: r.athlete_id,
          nome_allenamento: r.nome_allenamento,
          descrizione: r.descrizione,
          durata_min: r.durata_min,
          ts: r.timestamp,
        }),
      )
      .join("\n");

    await clickhouseQuery(
      `INSERT INTO ${clickhouseConfig.database}.allenamenti FORMAT JSONEachRow`,
      allenamentiPayload,
    );
    insertedAllenamenti = allenamentiRows.length;
  }

  if (allenamentoDettagliRows.length) {
    const dettagliPayload = allenamentoDettagliRows
      .map((r) =>
        JSON.stringify({
          allenamento_id: r.workout_id,
          atleta_id: r.athlete_id,
          esercizio_id: r.exercise_id,
          ordine: r.ordine,
          serie: r.serie,
          ripetizioni: r.ripetizioni,
          tempo_riposo_sec: r.tempo_riposo_sec,
          risultato: r.risultato,
          ts: r.timestamp,
        }),
      )
      .join("\n");

    await clickhouseQuery(
      `INSERT INTO ${clickhouseConfig.database}.allenamento_dettagli FORMAT JSONEachRow`,
      dettagliPayload,
    );
    insertedAllenamentoDettagli = allenamentoDettagliRows.length;
  }

  if (enduranceSessioniRows.length) {
    const enduranceSessioniPayload = enduranceSessioniRows
      .map((r) =>
        JSON.stringify({
          atleta_id: r.atleta_id,
          sessione_id: r.sessione_id,
          commento: r.commento,
          ts: r.ts,
        }),
      )
      .join("\n");

    await clickhouseQuery(
      `INSERT INTO ${clickhouseConfig.database}.corsa_endurance_sessioni FORMAT JSONEachRow`,
      enduranceSessioniPayload,
    );
    insertedEnduranceSessioni = enduranceSessioniRows.length;
  }

  if (enduranceCampioniRows.length) {
    const enduranceCampioniPayload = enduranceCampioniRows
      .map((r) =>
        JSON.stringify({
          atleta_id: r.athlete_id,
          sessione_id: r.sessione_id,
          secondo: r.secondo,
          heart_rate_bpm: r.heart_rate_bpm,
          cadence_spm: r.cadence_spm,
          speed_kmh: r.speed_kmh,
          altitude_m: r.altitude_m,
          temperature_c: r.temperature_c,
          ts: r.timestamp,
        }),
      )
      .join("\n");

    await clickhouseQuery(
      `INSERT INTO ${clickhouseConfig.database}.corsa_endurance_campioni FORMAT JSONEachRow`,
      enduranceCampioniPayload,
    );
    insertedEnduranceCampioni = enduranceCampioniRows.length;
  }

  return {
    allenamenti: insertedAllenamenti,
    allenamentoDettagli: insertedAllenamentoDettagli,
    corsaEnduranceSessioni: insertedEnduranceSessioni,
    corsaEnduranceCampioni: insertedEnduranceCampioni,
  };
}

async function main() {
  const pool = new pg.Pool(citusConfig);

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const athletes = generateAthletes(DEFAULT_ATHLETES);
      const exercises = generateExerciseCatalog(DEFAULT_EXERCISES);
      const summary = await seedCitus(client, athletes, exercises, DEFAULT_DAYS);
      await client.query("COMMIT");

      const clickhouseInserted = await seedClickhouse(
        summary.clickhouseAllenamenti,
        summary.clickhouseAllenamentoDettagli,
        summary.clickhouseEnduranceSessions,
        summary.clickhouseEnduranceCampioni,
      );

      console.log("Seed completato con successo");
      console.log({
        citus: {
          athletes: summary.athletes,
          exercises: summary.exercises,
          trainingStatus: summary.trainingStatus,
          smartwatchSessions: summary.smartwatchSessions,
        },
        clickhouse: {
          allenamentiRows: clickhouseInserted.allenamenti,
          allenamentoDettagliRows: clickhouseInserted.allenamentoDettagli,
          corsaEnduranceSessioniRows: clickhouseInserted.corsaEnduranceSessioni,
          corsaEnduranceCampioniRows: clickhouseInserted.corsaEnduranceCampioni,
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
