import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { spawn, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const pythonScriptsDir = path.join(projectRoot, "scripts", "python");

function resolvePythonExecutable() {
  if (process.env.PYTHON_BIN) {
    return { command: process.env.PYTHON_BIN, preArgs: [] };
  }

  const pythonCheck = spawnSync("python", ["--version"], { stdio: "ignore" });
  if (pythonCheck.status === 0) {
    return { command: "python", preArgs: [] };
  }

  const pyCheck = spawnSync("py", ["-3", "--version"], { stdio: "ignore" });
  if (pyCheck.status === 0) {
    return { command: "py", preArgs: ["-3"] };
  }

  return { command: "python", preArgs: [] };
}

const pythonRuntime = resolvePythonExecutable();

function resolvePythonScript(scriptName) {
  const scriptPath = path.join(pythonScriptsDir, scriptName);

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Script non trovato: ${scriptPath}`);
  }

  return scriptPath;
}

const app = express();
const port = Number(process.env.PORT || 3001);
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

// Citus Database connection
const pool = new pg.Pool({
  user: process.env.CITUS_POSTGRES_USER || "postgres",
  password: process.env.CITUS_POSTGRES_PASSWORD || "postgres",
  host: process.env.CITUS_HOST || "citus-coordinator",
  port: process.env.CITUS_PORT || 5432,
  database: process.env.CITUS_POSTGRES_DB || "bigintensive",
});

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

const events = [
  {
    id: "evt-001",
    topic: "demo-events",
    source: "producer.py",
    status: "processed",
    payload: "utente_registrato",
    createdAt: "2026-06-29T16:20:00Z",
  },
  {
    id: "evt-002",
    topic: "demo-events",
    source: "spark-stream",
    status: "queued",
    payload: "nuovo_workout",
    createdAt: "2026-06-29T16:23:00Z",
  },
];

function newEventId() {
  const value = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `evt-${value}`;
}

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "bigintensive-backend-api",
    timestamp: new Date().toISOString(),
  });
});

app.get("/events", (req, res) => {
  const ordered = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ items: ordered, total: ordered.length });
});

app.post("/events", (req, res) => {
  console.log("Received event:", req.body);
  const { topic, source, status, payload } = req.body || {};

  if (!topic || !source || !status || !payload) {
    return res.status(400).json({
      error: "Missing fields",
      required: ["topic", "source", "status", "payload"],
    });
  }

  const event = {
    id: newEventId(),
    topic,
    source,
    status,
    payload,
    createdAt: new Date().toISOString(),
  };

  events.push(event);
  return res.status(201).json(event);
});

app.delete("/events", (req, res) => {
  events.length = 0;
  res.status(204).send();
});

app.post("/force-plate/start", (req, res) => {
  const { athlete_id, exercise, duration_ms, repeat, interval_s } = req.body || {};

  // Validation
  if (!athlete_id || !exercise) {
    return res.status(400).json({
      error: "Missing required fields",
      required: ["athlete_id", "exercise"],
    });
  }

  const validExercises = ["squat", "jump", "leg_press"];
  if (!validExercises.includes(exercise)) {
    return res.status(400).json({
      error: "Invalid exercise",
      valid: validExercises,
    });
  }

  // Build command
  let pythonScript;

  try {
    pythonScript = resolvePythonScript("force_plate_producer.py");
  } catch (err) {
    return res.status(500).json({ error: "Python script path error", details: err.message });
  }

  const args = [...pythonRuntime.preArgs, pythonScript, "--athlete-id", athlete_id, "--exercise", exercise, "--duration-ms", String(duration_ms || 3000), "--repeat", String(repeat || 1), "--interval-s", String(interval_s || 2), "--topic", "force-plate-events"];

  // Spawn process
  const child = spawn(pythonRuntime.command, args, {
    stdio: "pipe",
    detached: false,
  });

  let output = "";
  let errorOutput = "";

  child.stdout.on("data", (data) => {
    output += data.toString();
    console.log(`[force-plate] ${data}`);
  });

  child.stderr.on("data", (data) => {
    errorOutput += data.toString();
    console.error(`[force-plate error] ${data}`);
  });

  child.on("error", (err) => {
    console.error(`[force-plate spawn error] ${err.message}`);
  });

  child.on("close", (code) => {
    console.log(`[force-plate] Process exited with code ${code}`);
  });

  res.json({
    status: "started",
    athlete_id,
    exercise,
    duration_ms: duration_ms || 3000,
    repeat: repeat || 1,
    interval_s: interval_s || 2,
    message: "Force plate simulation started in background",
  });
});

app.post("/heart-rate/start", (req, res) => {
  const { athlete_id, duration_ms, repeat, interval_s } = req.body || {};

  if (!athlete_id) {
    return res.status(400).json({
      error: "Missing required fields",
      required: ["athlete_id"],
    });
  }

  let pythonScript;

  try {
    pythonScript = resolvePythonScript("heart_rate_producer.py");
  } catch (err) {
    return res.status(500).json({ error: "Python script path error", details: err.message });
  }

  const args = [...pythonRuntime.preArgs, pythonScript, "--athlete-id", athlete_id, "--duration-ms", String(duration_ms || 30000), "--repeat", String(repeat || 1), "--interval-s", String(interval_s || 10), "--topic", "heart-rate-events"];

  const child = spawn(pythonRuntime.command, args, {
    stdio: "pipe",
    detached: false,
  });

  child.stdout.on("data", (data) => {
    console.log(`[heart-rate] ${data}`);
  });

  child.stderr.on("data", (data) => {
    console.error(`[heart-rate error] ${data}`);
  });

  child.on("error", (err) => {
    console.error(`[heart-rate spawn error] ${err.message}`);
  });

  child.on("close", (code) => {
    console.log(`[heart-rate] Process exited with code ${code}`);
  });

  res.json({
    status: "started",
    athlete_id,
    duration_ms: duration_ms || 30000,
    repeat: repeat || 1,
    interval_s: interval_s || 10,
    message: "Heart-rate simulation started in background",
  });
});

// Athletes endpoints
app.get("/athletes", async (req, res) => {
  try {
    const result = await pool.query("SELECT athlete_id, nome, cognome, eta, sesso, altezza_cm, peso_kg, created_at FROM athletes ORDER BY created_at DESC");
    res.json({ items: result.rows, total: result.rows.length });
  } catch (err) {
    console.error("Database error:", err.message);
    res.status(500).json({ error: "Database error", details: err.message });
  }
});

app.get("/athletes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT athlete_id, nome, cognome, eta, sesso, altezza_cm, peso_kg, created_at FROM athletes WHERE athlete_id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Athlete not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Database error:", err.message);
    res.status(500).json({ error: "Database error", details: err.message });
  }
});

app.post("/athletes", async (req, res) => {
  const { nome, cognome, eta, sesso, altezza_cm, peso_kg } = req.body || {};

  if (!nome || !cognome || !eta || !sesso || !altezza_cm || !peso_kg) {
    return res.status(400).json({
      error: "Missing required fields",
      required: ["nome", "cognome", "eta", "sesso", "altezza_cm", "peso_kg"],
    });
  }

  try {
    const result = await pool.query("INSERT INTO athletes (nome, cognome, eta, sesso, altezza_cm, peso_kg) VALUES ($1, $2, $3, $4, $5, $6) RETURNING athlete_id, nome, cognome, eta, sesso, altezza_cm, peso_kg, created_at", [nome, cognome, eta, sesso, altezza_cm, peso_kg]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Database error:", err.message);
    res.status(500).json({ error: "Database error", details: err.message });
  }
});

app.put("/athletes/:id", async (req, res) => {
  const { id } = req.params;
  const { nome, cognome, eta, sesso, altezza_cm, peso_kg } = req.body || {};

  if (!nome && !cognome && !eta && !sesso && !altezza_cm && !peso_kg) {
    return res.status(400).json({ error: "No fields to update" });
  }

  try {
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (nome !== undefined) {
      updates.push(`nome = $${paramIndex++}`);
      values.push(nome);
    }
    if (cognome !== undefined) {
      updates.push(`cognome = $${paramIndex++}`);
      values.push(cognome);
    }
    if (eta !== undefined) {
      updates.push(`eta = $${paramIndex++}`);
      values.push(eta);
    }
    if (sesso !== undefined) {
      updates.push(`sesso = $${paramIndex++}`);
      values.push(sesso);
    }
    if (altezza_cm !== undefined) {
      updates.push(`altezza_cm = $${paramIndex++}`);
      values.push(altezza_cm);
    }
    if (peso_kg !== undefined) {
      updates.push(`peso_kg = $${paramIndex++}`);
      values.push(peso_kg);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `UPDATE athletes SET ${updates.join(", ")} WHERE athlete_id = $${paramIndex} RETURNING athlete_id, nome, cognome, eta, sesso, altezza_cm, peso_kg, updated_at`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Athlete not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Database error:", err.message);
    res.status(500).json({ error: "Database error", details: err.message });
  }
});

app.listen(port, () => {
  console.log(`Backend API listening on http://localhost:${port}`);
});
