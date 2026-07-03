import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { createDeployLoadtestRouter } from "./routes/deployLoadtestRoutes.js";
import { createSimulationRouter } from "./routes/simulationRoutes.js";
import { createBusinessRouter } from "./routes/businessRoutes.js";
import { resolvePythonExecutable, resolveDockerExecutable } from "./utils/runtimeResolvers.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const pythonScriptsDir = path.join(projectRoot, "scripts", "python");
const k6ScriptPath = path.join(projectRoot, "scripts", "load", "k6-backend.js");
const k6SharedScriptPath = "/k6-shared/k6-backend.js";

const pythonRuntime = resolvePythonExecutable();
const k6DockerNetwork = process.env.K6_DOCKER_NETWORK || "bigintensive-spark_spark-net";
const k6DockerVolume = process.env.K6_DOCKER_VOLUME || "bigintensive-spark_k6-shared";

const dockerRuntime = resolveDockerExecutable();
const correlationMatrices = new Map();

function resolvePythonScript(scriptName) {
  const scriptPath = path.join(pythonScriptsDir, scriptName);

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Script non trovato: ${scriptPath}`);
  }

  return scriptPath;
}

const app = express();
const port = Number(process.env.PORT || 3001);
const corsOriginRaw = process.env.CORS_ORIGIN || "http://localhost:5173";
const explicitAllowedOrigins = corsOriginRaw
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (explicitAllowedOrigins.includes(origin)) {
    return true;
  }

  try {
    const parsed = new URL(origin);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

// Citus Database connection
const pool = new pg.Pool({
  user: process.env.CITUS_POSTGRES_USER || "postgres",
  password: process.env.CITUS_POSTGRES_PASSWORD || "postgres",
  host: process.env.CITUS_HOST || "citus-coordinator",
  port: process.env.CITUS_PORT || 5432,
  database: process.env.CITUS_POSTGRES_DB || "bigintensive",
});

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  }),
);
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "bigintensive-backend-api",
    timestamp: new Date().toISOString(),
  });
});

// ========================== SIMULATION ROUTES START =============================
app.use(createSimulationRouter({ pythonRuntime, resolvePythonScript }));
// =========================== SIMULATION ROUTES END ==============================

// ========================= DEPLOY/LOADTEST ROUTES START =========================
app.use(
  createDeployLoadtestRouter({
    dockerRuntime,
    k6ScriptPath,
    k6SharedScriptPath,
    k6DockerNetwork,
    k6DockerVolume,
  }),
);
// ========================== DEPLOY/LOADTEST ROUTES END ==========================

// =========================== BUSINESS ROUTES START ==============================
app.use(createBusinessRouter({ pool, correlationMatrices }));
// ============================ BUSINESS ROUTES END ===============================

app.listen(port, () => {
  console.log(`Backend API listening on http://localhost:${port}`);
});
