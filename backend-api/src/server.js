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
app.use(createDashboardRouter());

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
