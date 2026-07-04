import express from "express";
import {
  validateEventPayload,
  validateForcePlatePayload,
  validateHeartRatePayload,
} from "../validators/simulationValidators.js";
import { startPythonJob } from "../utils/pythonSpawn.js";

export function createSimulationRouter({ pythonRuntime, resolvePythonScript }) {
  const router = express.Router();

  const events = [
    {
      id: "evt-001",
      topic: "demo-events",
      source: "producer.py",
      status: "processed",
      payload: "utente_registrato",
      createdAt: "2026-06-29T16:20:00Z",
    },
    {
      id: "evt-002",
      topic: "demo-events",
      source: "spark-stream",
      status: "queued",
      payload: "nuovo_workout",
      createdAt: "2026-06-29T16:23:00Z",
    },
  ];

  function newEventId() {
    const value = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, "0");
    return `evt-${value}`;
  }

  router.get("/events", (req, res) => {
    const ordered = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ items: ordered, total: ordered.length });
  });

  router.post("/events", (req, res) => {
    console.log("Received event:", req.body);
    const validation = validateEventPayload(req.body);
    if (!validation.ok) {
      return res.status(validation.status).json(validation.payload);
    }

    const { topic, source, status, payload } = req.body || {};

    const event = {
      id: newEventId(),
      topic,
      source,
      status,
      payload,
      createdAt: new Date().toISOString(),
    };

    events.push(event);
    return res.status(201).json(event);
  });

  router.delete("/events", (req, res) => {
    events.length = 0;
    res.status(204).send();
  });

  router.post("/force-plate/start", (req, res) => {
    const { athlete_id, exercise, duration_ms, repeat, interval_s } = req.body || {};

    const validation = validateForcePlatePayload(req.body);
    if (!validation.ok) {
      return res.status(validation.status).json(validation.payload);
    }

    if (!pythonRuntime) {
      return res.status(500).json({
        error: "Python runtime not found",
        details: "Install Python and ensure python/py is in PATH, or set PYTHON_BIN in backend-api/.env",
      });
    }

    let pythonScript;

    try {
      pythonScript = resolvePythonScript("force_plate_producer.py");
    } catch (err) {
      return res.status(500).json({ error: "Python script path error", details: err.message });
    }

    const args = [
      ...pythonRuntime.preArgs,
      pythonScript,
      "--athlete-id",
      athlete_id,
      "--exercise",
      exercise,
      "--duration-ms",
      String(duration_ms || 3000),
      "--repeat",
      String(repeat || 1),
      "--interval-s",
      String(interval_s || 2),
      "--topic",
      "force-plate-events",
    ];

    startPythonJob({
      command: pythonRuntime.command,
      args,
      logTag: "force-plate",
    });

    return res.json({
      status: "started",
      athlete_id,
      exercise,
      duration_ms: duration_ms || 3000,
      repeat: repeat || 1,
      interval_s: interval_s || 2,
      message: "Force plate simulation started in background",
    });
  });

  router.post("/heart-rate/start", (req, res) => {
    const { athlete_id, duration_ms, repeat, interval_s, session_id } = req.body || {};

    const validation = validateHeartRatePayload(req.body);
    if (!validation.ok) {
      return res.status(validation.status).json(validation.payload);
    }

    if (!pythonRuntime) {
      return res.status(500).json({
        error: "Python runtime not found",
        details: "Install Python and ensure python/py is in PATH, or set PYTHON_BIN in backend-api/.env",
      });
    }

    let pythonScript;

    try {
      pythonScript = resolvePythonScript("heart_rate_producer.py");
    } catch (err) {
      return res.status(500).json({ error: "Python script path error", details: err.message });
    }

    const args = [
      ...pythonRuntime.preArgs,
      pythonScript,
      "--athlete-id",
      athlete_id,
      "--duration-ms",
      String(duration_ms || 30000),
      "--repeat",
      String(repeat || 1),
      "--interval-s",
      String(interval_s || 10),
      "--topic",
      "heart-rate-events",
    ];

    if (session_id !== undefined) {
      args.push("--session-id", String(session_id));
    }

    startPythonJob({
      command: pythonRuntime.command,
      args,
      logTag: "heart-rate",
    });

    return res.json({
      status: "started",
      athlete_id,
      session_id: session_id || null,
      duration_ms: duration_ms || 30000,
      repeat: repeat || 1,
      interval_s: interval_s || 10,
      message: "Heart-rate simulation started in background",
    });
  });

  return router;
}
