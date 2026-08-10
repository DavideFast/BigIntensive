import express from "express";
import fs from "fs";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { validateLoadtestPayload } from "../validators/loadtestValidators.js";

export function createDeployLoadtestRouter({ dockerRuntime, k6ScriptPath, k6SharedScriptPath, k6DockerNetwork, k6DockerVolume }) {
  const router = express.Router();
  const loadtestJobs = new Map();

  router.post("/loadtest/start", (req, res) => {
    const { base_url } = req.body || {};
    const validation = validateLoadtestPayload(req.body);
    if (!validation.ok) {
      return res.status(validation.status).json(validation.payload);
    }

    const { endpointMode, parsedVus, parsedDuration } = validation;
    const baseUrl = String(base_url || "http://backend-api:3001").trim();

    if (!dockerRuntime) {
      return res.status(500).json({
        error: "Docker CLI not available in backend container",
        details: "Install docker CLI in backend image and mount Docker socket.",
      });
    }

    let k6ScriptContent = "";

    try {
      k6ScriptContent = fs.readFileSync(k6ScriptPath, "utf8");
    } catch (err) {
      return res.status(500).json({
        error: "k6 script not available",
        details: err.message,
      });
    }

    try {
      fs.writeFileSync(k6SharedScriptPath, k6ScriptContent, "utf8");
    } catch (err) {
      return res.status(500).json({
        error: "Cannot prepare shared k6 script",
        details: err.message,
      });
    }

    const jobId = randomUUID();
    const args = ["run", "--rm", "--network", k6DockerNetwork, "-v", `${k6DockerVolume}:/scripts/load:ro`, "-e", `BASE_URL=${baseUrl}`, "-e", `ENDPOINT_MODE=${endpointMode}`, "grafana/k6:0.53.0", "run", "--vus", String(parsedVus), "--duration", parsedDuration, "/scripts/load/k6-backend.js"];

    loadtestJobs.set(jobId, {
      id: jobId,
      status: "starting",
      mode: endpointMode,
      vus: parsedVus,
      duration: parsedDuration,
      baseUrl,
      network: k6DockerNetwork,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      exitCode: null,
      outputTail: "",
    });

    const child = spawn(dockerRuntime, args, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    child.stdout.on("data", (data) => {
      const chunk = data.toString();
      const job = loadtestJobs.get(jobId);
      if (!job) {
        return;
      }

      const nextTail = `${job.outputTail}${chunk}`;
      job.outputTail = nextTail.slice(-8000);
      if (job.status === "starting") {
        job.status = "running";
      }
    });

    child.stderr.on("data", (data) => {
      const chunk = data.toString();
      const job = loadtestJobs.get(jobId);
      if (!job) {
        return;
      }

      const nextTail = `${job.outputTail}${chunk}`;
      job.outputTail = nextTail.slice(-8000);
      if (job.status === "starting") {
        job.status = "running";
      }
    });

    child.on("error", (err) => {
      const job = loadtestJobs.get(jobId);
      if (!job) {
        return;
      }

      job.status = "failed";
      job.finishedAt = new Date().toISOString();
      job.exitCode = -1;
      job.outputTail = `${job.outputTail}\n[spawn error] ${err.message}`.slice(-8000);
    });

    child.on("close", (code) => {
      const job = loadtestJobs.get(jobId);
      if (!job) {
        return;
      }

      job.status = code === 0 ? "completed" : "failed";
      job.finishedAt = new Date().toISOString();
      job.exitCode = code;
    });

    return res.status(202).json({
      status: "started",
      jobId,
      mode: endpointMode,
      vus: parsedVus,
      duration: parsedDuration,
      baseUrl,
    });
  });

  router.get("/loadtest/jobs/:id", (req, res) => {
    const job = loadtestJobs.get(req.params.id);

    if (!job) {
      return res.status(404).json({ error: "Load test job not found" });
    }

    return res.json(job);
  });

  return router;
}
