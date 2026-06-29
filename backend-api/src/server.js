import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

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

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "bigintensive-backend-api",
    timestamp: new Date().toISOString(),
  });
});

app.get("/events", (req, res) => {
  const ordered = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ items: ordered, total: ordered.length });
});

app.post("/events", (req, res) => {
  const { topic, source, status, payload } = req.body || {};

  if (!topic || !source || !status || !payload) {
    return res.status(400).json({
      error: "Missing fields",
      required: ["topic", "source", "status", "payload"],
    });
  }

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

app.delete("/events", (req, res) => {
  events.length = 0;
  res.status(204).send();
});

app.listen(port, () => {
  console.log(`Backend API listening on http://localhost:${port}`);
});
