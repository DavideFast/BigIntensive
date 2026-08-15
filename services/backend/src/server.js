import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createDeployLoadtestRouter } from "./routes/deployLoadtestRoutes.js";
import { createSimulationRouter } from "./routes/simulationRoutes.js";
import { createBusinessRouter } from "./routes/businessRoutes.js";
import { createSystemRouter } from "./routes/systemRoutes.js";
import { createDashboardRouter } from "./routes/dashboardRoutes.js";
import { createSparkJobsRouter } from "./routes/sparkJobsRoutes.js";
import { createServerContext } from "./bootstrap/serverContext.js";
import { createClickhouseClient } from "./db/pool.js";
import { createDbPool } from "./db/pool.js";

dotenv.config();
const context = createServerContext(import.meta.url);
const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (context.isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  }),
);
app.use(express.json());
app.use(createSystemRouter());

// ========================= LETTURE CITUS ESEMPIO  ============================
app.get("/api/v1/readCitus", (req, res) => {
  const query = "SELECT * FROM allenamenti WHERE atleta_id = 1 LIMIT 10";
  context.pool.query(query, (err, result) => {
    if (err) {
      console.error("Errore query PostgreSQL:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, count: result.rows.length, data: result.rows });
  });
});

app.get("/api/v1/writeCitus", (req, res) => {
  const query = `INSERT INTO allenamenti (atleta_id, sessione_id, frequenza_cardiaca, velocita, timestamp)
                 VALUES (1, 1, 120, 10.5, '2024-06-05 12:00:00')`;
  context.pool.query(query, (err, result) => {
    if (err) {
      console.error("Errore query PostgreSQL:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
});

// ========================= LETTURE CLICKHOUSE ESEMPIO  ============================
app.get("/api/v1/readClickhouse", async (req, res) => {
  const valore = await createClickhouseClient.query({
    query: "SELECT * FROM allenamenti WHERE atleta_id = 1 LIMIT 10",
    format: "JSONEachRow",
  });
  const data = await valore.json();
  res.json({ success: true, count: data.length, data: data });
});

app.post("/api/v1/writeClickhouse", async (req, res) => {
  const allenamento = {
    allenamento: {
      data: "2026-08-15",
      tipo: "Forza - Push Day",
      durata_minuti: 75,
      note: "Ottimo volume sul petto, progresso nel carico rispetto alla settimana scorsa.",
      esercizi: [
        {
          nome: "Panca Piana con bilanciere",
          gruppo_muscolare: "Petto",
          serie: [
            { numero: 1, ripetizioni: 10, carico_kg: 60 },
            { numero: 2, ripetizioni: 8, carico_kg: 65 },
            { numero: 3, ripetizioni: 6, carico_kg: 70 },
          ],
        },
        {
          nome: "Military Press",
          gruppo_muscolare: "Spalle",
          serie: [
            { numero: 1, ripetizioni: 10, carico_kg: 30 },
            { numero: 2, ripetizioni: 10, carico_kg: 30 },
            { numero: 3, ripetizioni: 8, carico_kg: 35 },
          ],
        },
        {
          nome: "Croci ai cavi",
          gruppo_muscolare: "Petto",
          serie: [
            { numero: 1, ripetizioni: 12, carico_kg: 15 },
            { numero: 2, ripetizioni: 12, carico_kg: 15 },
            { numero: 3, ripetizioni: 12, carico_kg: 15 },
          ],
        },
        {
          nome: "Pushdown tricipiti",
          gruppo_muscolare: "Tricipiti",
          serie: [
            { numero: 1, ripetizioni: 15, carico_kg: 20 },
            { numero: 2, ripetizioni: 12, carico_kg: 25 },
            { numero: 3, ripetizioni: 10, carico_kg: 30 },
          ],
        },
      ],
    },
  };
  const valore = await createClickhouseClient.query({
    query: "INSERT INTO allenamenti (atleta_id, sessione_id, frequenza_cardiaca, velocita, timestamp) VALUES (1, 1, 120, 10.5, '2024-06-05 12:00:00')",
    format: "JSONEachRow",
  });
  const data = await valore.json();
  res.json({ success: true, count: data.length, data: data });
});

// ========================== SIMULATION ROUTES START =============================
app.use(
  createSimulationRouter({
    pythonRuntime: context.pythonRuntime,
    resolvePythonScript: context.resolvePythonScript,
    kafkaProducer: context.kafkaProducer,
    pool: context.pool,
  }),
);

// ========================= DEPLOY/LOADTEST ROUTES START =========================
app.use(
  createDeployLoadtestRouter({
    dockerRuntime: context.dockerRuntime,
    k6ScriptPath: context.k6ScriptPath,
    k6SharedScriptPath: context.k6SharedScriptPath,
    k6DockerNetwork: context.k6DockerNetwork,
    k6DockerVolume: context.k6DockerVolume,
  }),
);

// ========================== SPARK JOB ROUTES START ============================
app.use(
  createSparkJobsRouter({
    dockerRuntime: context.dockerRuntime,
    sparkComposeService: context.sparkComposeService,
    sparkMasterUrl: context.sparkMasterUrl,
    sparkAppsDir: context.sparkAppsDir,
    sparkCitusJdbcUrl: context.sparkCitusJdbcUrl,
    sparkClickhouseJdbcUrl: context.sparkClickhouseJdbcUrl,
    sparkKafkaBootstrapServers: context.sparkKafkaBootstrapServers,
    sparkKafkaTopic: context.sparkKafkaTopic,
    sparkClickhouseTable: context.sparkClickhouseTable,
    sparkClickhouseUser: context.sparkClickhouseUser,
    sparkClickhousePassword: context.sparkClickhousePassword,
    sparkCheckpointDir: context.sparkCheckpointDir,
  }),
);

// =========================== BUSINESS ROUTES START ==============================
app.use(
  createBusinessRouter({
    pool: context.pool,
    correlationStore: context.correlationStore,
  }),
);

// ============================ DASHBOARD ROUTES START ===========================
app.use(
  createDashboardRouter({
    pool: context.pool,
    clickhouseConfig: context.clickhouse,
  }),
);

// ============================ AVVIO ===============================
app.listen(context.port, () => {
  console.log(`Backend API listening on http://localhost:${context.port}`);
});

process.on("SIGINT", async () => {
  await context.kafkaProducer.disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await context.kafkaProducer.disconnect();
  process.exit(0);
});
