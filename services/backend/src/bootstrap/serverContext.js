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
  const backendRoot = path.resolve(__dirname, "../..");
  const scriptsRoot = path.join(backendRoot, "scripts");

  const pythonScriptsDir = scriptsRoot;
  const k6ScriptPath = path.join(scriptsRoot, "k6-backend.js");

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
    sparkComposeService: process.env.SPARK_COMPOSE_SERVICE || "spark-master",
    sparkMasterUrl: process.env.SPARK_MASTER_URL || "spark://spark-master:7077",
    sparkAppsDir: process.env.SPARK_APPS_DIR || "/opt/spark-apps",
    sparkCitusJdbcUrl: process.env.SPARK_POSTGRES_JDBC_URL || "jdbc:postgresql://postgres:5432/bigintensive",
    sparkClickhouseJdbcUrl: process.env.SPARK_CLICKHOUSE_JDBC_URL || "jdbc:clickhouse://clickhouse:8123/bigintensive",
    sparkKafkaBootstrapServers: process.env.SPARK_KAFKA_BOOTSTRAP_SERVERS || "kafka:19092",
    sparkKafkaTopic: process.env.SPARK_KAFKA_TOPIC || "heart-rate-events",
    sparkClickhouseTable: process.env.SPARK_CLICKHOUSE_TABLE || "bigintensive.corsa_endurance_campioni",
    sparkClickhouseUser: process.env.SPARK_CLICKHOUSE_USER || "default",
    sparkClickhousePassword: process.env.SPARK_CLICKHOUSE_PASSWORD || "",
    sparkCheckpointDir: process.env.SPARK_CHECKPOINT_DIR || "/tmp/spark-checkpoints/smartwatch-to-clickhouse",
    clickhouse: {
      host: process.env.CLICKHOUSE_HOST || "clickhouse",
      port: Number(process.env.CLICKHOUSE_PORT || 8123),
      database: process.env.CLICKHOUSE_DB || process.env.CLICKHOUSE_DATABASE || "bigintensive",
      user: process.env.CLICKHOUSE_USER || "default",
      password: process.env.CLICKHOUSE_PASSWORD || "",
    },
  };
}
