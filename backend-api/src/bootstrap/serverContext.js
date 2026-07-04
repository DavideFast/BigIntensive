import path from "path";
import { fileURLToPath } from "url";
import { createDbPool } from "../db/pool.js";
import { createOriginChecker } from "../middleware/corsOrigin.js";
import { resolvePythonExecutable, resolveDockerExecutable } from "../utils/runtimeResolvers.js";
import { createResolvePythonScript } from "../utils/pythonScriptResolver.js";
import { createCorrelationStore } from "../stores/correlationStore.js";
import { createKafkaProducerFromEnv } from "../utils/kafkaProducer.js";

export function createServerContext(importMetaUrl) {
  const __filename = fileURLToPath(importMetaUrl);
  const __dirname = path.dirname(__filename);
  const projectRoot = path.resolve(__dirname, "../../..");

  const pythonScriptsDir = path.join(projectRoot, "scripts", "python");
  const k6ScriptPath = path.join(projectRoot, "scripts", "load", "k6-backend.js");

  return {
    port: Number(process.env.PORT || 3001),
    isAllowedOrigin: createOriginChecker(process.env.CORS_ORIGIN || "http://localhost:5173"),
    pool: createDbPool(),
    correlationStore: createCorrelationStore(),
    kafkaProducer: createKafkaProducerFromEnv(),
    pythonRuntime: resolvePythonExecutable(),
    dockerRuntime: resolveDockerExecutable(),
    resolvePythonScript: createResolvePythonScript(pythonScriptsDir),
    k6ScriptPath,
    k6SharedScriptPath: process.env.K6_SHARED_SCRIPT_PATH || "/k6-shared/k6-backend.js",
    k6DockerNetwork: process.env.K6_DOCKER_NETWORK || "bigintensive-spark_spark-net",
    k6DockerVolume: process.env.K6_DOCKER_VOLUME || "bigintensive-spark_k6-shared",
  };
}
