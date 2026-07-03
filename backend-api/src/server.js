import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createDeployLoadtestRouter } from "./routes/deployLoadtestRoutes.js";
import { createSimulationRouter } from "./routes/simulationRoutes.js";
import { createBusinessRouter } from "./routes/businessRoutes.js";
import { createSystemRouter } from "./routes/systemRoutes.js";
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

// =========================== BUSINESS ROUTES START ==============================
app.use(
  createBusinessRouter({
    pool: context.pool,
    correlationMatrices: context.correlationMatrices,
  }),
);

// ============================ AVVIO ===============================
app.listen(context.port, () => {
  console.log(`Backend API listening on http://localhost:${context.port}`);
});
