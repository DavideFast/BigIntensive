import express from "express";
import { spawn } from "child_process";
import { randomUUID } from "crypto";

const JOB_SPECS = {
  job1: {
    id: "job1",
    name: "training-status",
    script: "trainingstatusjob.py",
  },
  job2: {
    id: "job2",
    name: "exercise-correlation",
    script: "exercisesComparison.py",
  },
  job3: {
    id: "job3",
    name: "training-volume",
    script: "trainingVolume.py",
  },
};

const STREAM_SCRIPT = "consumer.py";

function buildEnvPrefix(envMap) {
  return Object.entries(envMap)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    .map(([key, value]) => `${key}=${JSON.stringify(String(value))}`)
    .join(" ");
}

function parseJobKey(value) {
  return String(value || "").trim().toLowerCase();
}

function validateTriggerPayload(body) {
  const key = parseJobKey(body?.job);

  if (!JOB_SPECS[key]) {
    return {
      ok: false,
      status: 400,
      payload: {
        error: "Invalid job",
        valid: Object.keys(JOB_SPECS),
      },
    };
  }

  return {
    ok: true,
    job: JOB_SPECS[key],
  };
}

function buildSparkSubmitCommand({ job, composeService, sparkMasterUrl, sparkAppsDir, citusJdbcUrl, clickhouseJdbcUrl }) {
  const scriptPath = `${sparkAppsDir}/${job.script}`;
  const exportsPrefixRaw = buildEnvPrefix({
    CITUS_JDBC_URL: citusJdbcUrl,
    CLICKHOUSE_JDBC_URL: clickhouseJdbcUrl,
  });
  const exportsPrefix = exportsPrefixRaw ? `${exportsPrefixRaw} ` : "";
  const submitCommand = `${exportsPrefix}spark-submit --master ${sparkMasterUrl} ${scriptPath}`;

  return [
    "compose",
    "exec",
    "-T",
    composeService,
    "sh",
    "-lc",
    submitCommand,
  ];
}

function buildSparkStreamingCommand({
  composeService,
  sparkMasterUrl,
  sparkAppsDir,
  kafkaBootstrapServers,
  kafkaTopic,
  clickhouseJdbcUrl,
  clickhouseTable,
  clickhouseUser,
  clickhousePassword,
  checkpointDir,
  startingOffsets,
}) {
  const scriptPath = `${sparkAppsDir}/${STREAM_SCRIPT}`;
  const exportsPrefixRaw = buildEnvPrefix({
    KAFKA_BOOTSTRAP_SERVERS: kafkaBootstrapServers,
    KAFKA_TOPIC: kafkaTopic,
    CLICKHOUSE_JDBC_URL: clickhouseJdbcUrl,
    CLICKHOUSE_TABLE: clickhouseTable,
    CLICKHOUSE_USER: clickhouseUser,
    CLICKHOUSE_PASSWORD: clickhousePassword,
    SPARK_CHECKPOINT_DIR: checkpointDir,
    SPARK_STREAM_STARTING_OFFSETS: startingOffsets,
  });
  const exportsPrefix = exportsPrefixRaw ? `${exportsPrefixRaw} ` : "";
  const submitCommand = `${exportsPrefix}spark-submit --master ${sparkMasterUrl} ${scriptPath}`;

  return [
    "compose",
    "exec",
    "-T",
    composeService,
    "sh",
    "-lc",
    submitCommand,
  ];
}

function parseStartingOffsets(rawValue) {
  const value = String(rawValue || "latest").trim().toLowerCase();
  return ["latest", "earliest"].includes(value) ? value : null;
}

export function createSparkJobsRouter({
  dockerRuntime,
  sparkComposeService,
  sparkMasterUrl,
  sparkAppsDir,
  sparkCitusJdbcUrl,
  sparkClickhouseJdbcUrl,
  sparkKafkaBootstrapServers,
  sparkKafkaTopic,
  sparkClickhouseTable,
  sparkClickhouseUser,
  sparkClickhousePassword,
  sparkCheckpointDir,
}) {
  const router = express.Router();
  const jobs = new Map();
  let streaming = null;
  let streamingChild = null;

  router.get("/spark/jobs", (req, res) => {
    const items = [...jobs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return res.json({ items, total: items.length });
  });

  router.post("/spark/jobs/start", (req, res) => {
    const validation = validateTriggerPayload(req.body);
    if (!validation.ok) {
      return res.status(validation.status).json(validation.payload);
    }

    if (!dockerRuntime) {
      return res.status(500).json({
        error: "Docker CLI not available in backend container",
        details: "Install docker CLI in backend image and mount Docker socket.",
      });
    }

    const { job } = validation;
    const jobId = randomUUID();

    const citusJdbcUrl = String(req.body?.citus_jdbc_url || sparkCitusJdbcUrl || "").trim() || null;
    const clickhouseJdbcUrl = String(req.body?.clickhouse_jdbc_url || sparkClickhouseJdbcUrl || "").trim() || null;

    const args = buildSparkSubmitCommand({
      job,
      composeService: sparkComposeService,
      sparkMasterUrl,
      sparkAppsDir,
      citusJdbcUrl,
      clickhouseJdbcUrl,
    });

    jobs.set(jobId, {
      id: jobId,
      job: job.id,
      name: job.name,
      script: job.script,
      status: "starting",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      exitCode: null,
      composeService: sparkComposeService,
      sparkMasterUrl,
      citusJdbcUrl,
      clickhouseJdbcUrl,
      outputTail: "",
    });

    const child = spawn(dockerRuntime, args, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    child.stdout.on("data", (data) => {
      const state = jobs.get(jobId);
      if (!state) {
        return;
      }

      const chunk = data.toString();
      state.outputTail = `${state.outputTail}${chunk}`.slice(-12000);
      if (state.status === "starting") {
        state.status = "running";
      }
    });

    child.stderr.on("data", (data) => {
      const state = jobs.get(jobId);
      if (!state) {
        return;
      }

      const chunk = data.toString();
      state.outputTail = `${state.outputTail}${chunk}`.slice(-12000);
      if (state.status === "starting") {
        state.status = "running";
      }
    });

    child.on("error", (err) => {
      const state = jobs.get(jobId);
      if (!state) {
        return;
      }

      state.status = "failed";
      state.finishedAt = new Date().toISOString();
      state.exitCode = -1;
      state.outputTail = `${state.outputTail}\n[spawn error] ${err.message}`.slice(-12000);
    });

    child.on("close", (code) => {
      const state = jobs.get(jobId);
      if (!state) {
        return;
      }

      state.status = code === 0 ? "completed" : "failed";
      state.finishedAt = new Date().toISOString();
      state.exitCode = code;
    });

    return res.status(202).json({
      status: "started",
      jobId,
      job: job.id,
      script: job.script,
      composeService: sparkComposeService,
      sparkMasterUrl,
    });
  });

  router.get("/spark/jobs/:id", (req, res) => {
    const state = jobs.get(req.params.id);

    if (!state) {
      return res.status(404).json({ error: "Spark job not found" });
    }

    return res.json(state);
  });

  router.get("/spark/streaming/status", (req, res) => {
    if (!streaming) {
      return res.json({ status: "stopped", stream: null });
    }

    return res.json({ status: streaming.status, stream: streaming });
  });

  router.post("/spark/streaming/start", (req, res) => {
    if (!dockerRuntime) {
      return res.status(500).json({
        error: "Docker CLI not available in backend container",
        details: "Install docker CLI in backend image and mount Docker socket.",
      });
    }

    if (streaming && (streaming.status === "starting" || streaming.status === "running")) {
      return res.status(409).json({
        error: "Streaming already running",
        streamId: streaming.id,
      });
    }

    const startingOffsets = parseStartingOffsets(req.body?.starting_offsets);
    if (!startingOffsets) {
      return res.status(400).json({
        error: "Invalid starting_offsets",
        valid: ["latest", "earliest"],
      });
    }

    const streamId = randomUUID();
    const kafkaBootstrapServers = String(req.body?.kafka_bootstrap_servers || sparkKafkaBootstrapServers || "kafka:19092").trim();
    const kafkaTopic = String(req.body?.kafka_topic || sparkKafkaTopic || "heart-rate-events").trim();
    const clickhouseJdbcUrl = String(req.body?.clickhouse_jdbc_url || sparkClickhouseJdbcUrl || "jdbc:clickhouse://clickhouse:8123/bigintensive").trim();
    const clickhouseTable = String(req.body?.clickhouse_table || sparkClickhouseTable || "bigintensive.corsa_endurance_campioni").trim();
    const clickhouseUser = String(req.body?.clickhouse_user || sparkClickhouseUser || "default").trim();
    const clickhousePassword = String(req.body?.clickhouse_password ?? sparkClickhousePassword ?? "");
    const checkpointDir = String(req.body?.checkpoint_dir || sparkCheckpointDir || "/tmp/spark-checkpoints/smartwatch-to-clickhouse").trim();

    const args = buildSparkStreamingCommand({
      composeService: sparkComposeService,
      sparkMasterUrl,
      sparkAppsDir,
      kafkaBootstrapServers,
      kafkaTopic,
      clickhouseJdbcUrl,
      clickhouseTable,
      clickhouseUser,
      clickhousePassword,
      checkpointDir,
      startingOffsets,
    });

    streaming = {
      id: streamId,
      script: STREAM_SCRIPT,
      status: "starting",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      exitCode: null,
      composeService: sparkComposeService,
      sparkMasterUrl,
      kafkaBootstrapServers,
      kafkaTopic,
      clickhouseJdbcUrl,
      clickhouseTable,
      checkpointDir,
      startingOffsets,
      outputTail: "",
    };

    const child = spawn(dockerRuntime, args, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });
    streamingChild = child;

    child.stdout.on("data", (data) => {
      if (!streaming || streaming.id !== streamId) {
        return;
      }

      const chunk = data.toString();
      streaming.outputTail = `${streaming.outputTail}${chunk}`.slice(-24000);
      if (streaming.status === "starting") {
        streaming.status = "running";
      }
    });

    child.stderr.on("data", (data) => {
      if (!streaming || streaming.id !== streamId) {
        return;
      }

      const chunk = data.toString();
      streaming.outputTail = `${streaming.outputTail}${chunk}`.slice(-24000);
      if (streaming.status === "starting") {
        streaming.status = "running";
      }
    });

    child.on("error", (err) => {
      if (!streaming || streaming.id !== streamId) {
        return;
      }

      streaming.status = "failed";
      streaming.finishedAt = new Date().toISOString();
      streaming.exitCode = -1;
      streaming.outputTail = `${streaming.outputTail}\n[spawn error] ${err.message}`.slice(-24000);
    });

    child.on("close", (code) => {
      if (!streaming || streaming.id !== streamId) {
        return;
      }

      streaming.status = code === 0 ? "completed" : "failed";
      streaming.finishedAt = new Date().toISOString();
      streaming.exitCode = code;
      streamingChild = null;
    });

    return res.status(202).json({
      status: "started",
      streamId,
      script: STREAM_SCRIPT,
      kafkaTopic,
      clickhouseTable,
      startingOffsets,
    });
  });

  router.post("/spark/streaming/stop", (req, res) => {
    if (!streaming || (streaming.status !== "starting" && streaming.status !== "running")) {
      return res.status(409).json({ error: "No running stream" });
    }

    if (streamingChild && !streamingChild.killed) {
      streamingChild.kill("SIGTERM");
    }

    streaming.status = "stopped";
    streaming.finishedAt = new Date().toISOString();
    if (streaming.exitCode === null) {
      streaming.exitCode = 0;
    }

    return res.json({ status: "stopped", streamId: streaming.id });
  });

  return router;
}
