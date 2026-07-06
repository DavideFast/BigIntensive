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
  const exportParts = [];

  if (citusJdbcUrl) {
    exportParts.push(`CITUS_JDBC_URL=${JSON.stringify(citusJdbcUrl)}`);
  }

  if (clickhouseJdbcUrl) {
    exportParts.push(`CLICKHOUSE_JDBC_URL=${JSON.stringify(clickhouseJdbcUrl)}`);
  }

  const exportsPrefix = exportParts.length > 0 ? `${exportParts.join(" ")} ` : "";
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

export function createSparkJobsRouter({
  dockerRuntime,
  sparkComposeService,
  sparkMasterUrl,
  sparkAppsDir,
  sparkCitusJdbcUrl,
  sparkClickhouseJdbcUrl,
}) {
  const router = express.Router();
  const jobs = new Map();

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

  return router;
}
