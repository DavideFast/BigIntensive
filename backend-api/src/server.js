import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createDeployLoadtestRouter } from "./routes/deployLoadtestRoutes.js";
import { createSimulationRouter } from "./routes/simulationRoutes.js";
import { createBusinessRouter } from "./routes/businessRoutes.js";
import { createSystemRouter } from "./routes/systemRoutes.js";
import { createDbPool } from "./db/pool.js";
import { createOriginChecker } from "./middleware/corsOrigin.js";
import { resolvePythonExecutable, resolveDockerExecutable } from "./utils/runtimeResolvers.js";
import { createResolvePythonScript } from "./utils/pythonScriptResolver.js";

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
const resolvePythonScript = createResolvePythonScript(pythonScriptsDir);

const app = express();
const port = Number(process.env.PORT || 3001);
const isAllowedOrigin = createOriginChecker(process.env.CORS_ORIGIN || "http://localhost:5173");
const pool = createDbPool();

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
app.use(createSystemRouter());

// ========================== SIMULATION ROUTES START =============================
app.use(createSimulationRouter({ pythonRuntime, resolvePythonScript }));

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

// =========================== BUSINESS ROUTES START ==============================
app.use(createBusinessRouter({ pool, correlationMatrices }));

// ============================ AVVIO ===============================
app.listen(port, () => {
  console.log(`Backend API listening on http://localhost:${port}`);
});
