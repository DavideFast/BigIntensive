import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { createSystemRouter } from "./routes/systemRoutes.js";
import { createServerContext } from "./bootstrap/serverContext.js";
import { createClickhouseClient } from "./db/pool.js";
import { Kafka } from "kafkajs";
import { AppsV1Api, KubeConfig } from "@kubernetes/client-node";

// ============================ CONFIGURAZIONE ===============================

// Configurazione del client Kubernetes
const kubeConfig = new KubeConfig();
kubeConfig.loadFromDefault();
const k8sApi = kubeConfig.makeApiClient(AppsV1Api);
const kubernetesNamespace = process.env.KUBERNETES_NAMESPACE || "bigintensive";

// Configurazione del produttore Kafka
const kafkaBrokers = String(process.env.KAFKA_BOOTSTRAP_SERVERS || "kafka:19092")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const kafka = new Kafka({
  clientId: "my-express-api",
  brokers: kafkaBrokers,
});
const producer = kafka.producer();
const smartwatchKafkaTopic = process.env.SMARTWATCH_KAFKA_TOPIC || "heart-rate-events";
let producerConnected = false;

async function ensureProducerConnected() {
  if (!producerConnected) {
    await producer.connect();
    producerConnected = true;
  }
}

function getKubernetesErrorMessage(error) {
  return error?.body?.message || error?.response?.body?.message || error?.message || "Errore Kubernetes sconosciuto";
}

// ============================ SERVER ===============================
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

// =========================== READ/WRITE DATABASE  ==============================
app.get("/api/v1/readPostgresql", (req, res) => {
  const query = "SELECT * FROM allenamenti WHERE atleta_id = 1 LIMIT 10";
  context.pool.query(query, (err, result) => {
    if (err) {
      console.error("Errore query PostgreSQL:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, count: result.rows.length, data: result.rows });
  });
});

app.get("/api/v1/writePostgresql", (req, res) => {
  const allenamento = {
    allenamento: {
      data: "2026-08-15",
      tipo: "Forza - Push Day",
      durata_minuti: 75,
      note: "Ottimo volume sul petto, progresso nel carico rispetto alla settimana scorsa.",
      esercizi: [
        {
          nome: "Panca Piana con bilanciere",
          gruppo_muscolare: "Petto",
          serie: [
            { numero: 1, ripetizioni: 10, carico_kg: 60 },
            { numero: 2, ripetizioni: 8, carico_kg: 65 },
            { numero: 3, ripetizioni: 6, carico_kg: 70 },
          ],
        },
        {
          nome: "Military Press",
          gruppo_muscolare: "Spalle",
          serie: [
            { numero: 1, ripetizioni: 10, carico_kg: 30 },
            { numero: 2, ripetizioni: 10, carico_kg: 30 },
            { numero: 3, ripetizioni: 8, carico_kg: 35 },
          ],
        },
        {
          nome: "Croci ai cavi",
          gruppo_muscolare: "Petto",
          serie: [
            { numero: 1, ripetizioni: 12, carico_kg: 15 },
            { numero: 2, ripetizioni: 12, carico_kg: 15 },
            { numero: 3, ripetizioni: 12, carico_kg: 15 },
          ],
        },
        {
          nome: "Pushdown tricipiti",
          gruppo_muscolare: "Tricipiti",
          serie: [
            { numero: 1, ripetizioni: 15, carico_kg: 20 },
            { numero: 2, ripetizioni: 12, carico_kg: 25 },
            { numero: 3, ripetizioni: 10, carico_kg: 30 },
          ],
        },
      ],
    },
  };
  const query = `INSERT INTO allenamenti (atleta_id, sessione_id, frequenza_cardiaca, velocita, timestamp,struttura_allenamento)
                 VALUES (1, 1, 120, 10.5, '2024-06-05 12:00:00', '${JSON.stringify(allenamento)}')`;
  context.pool.query(query, (err, result) => {
    if (err) {
      console.error("Errore query PostgreSQL:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });
});

app.get("/api/v1/readClickhouse", async (req, res) => {
  try {
    const valore = await createClickhouseClient.query({
      query: "SELECT * FROM running_samples WHERE session_id = (SELECT session_id FROM running_samples WHERE athlete_id = 1 LIMIT 1)",
      format: "JSONEachRow",
    });
    const data = await valore.json();
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error("Errore query ClickHouse:", error.message);
    res.status(503).json({ success: false, error: "ClickHouse non disponibile" });
  }
});

app.post("/api/v1/pushToKafka", async (req, res) => {
  try {
    await ensureProducerConnected();
    await producer.send({
      topic: smartwatchKafkaTopic,
      messages: [{ key: req.body.atleta_id.toString() + "-" + req.body.sessione_id.toString(), value: JSON.stringify(req.body) }],
    });

    res.status(202).json({
      success: true,
      message: "Evento inviato a Kafka",
    });
  } catch (error) {
    console.error("Errore Kafka:", error);

    res.status(500).json({
      success: false,
      error: "Impossibile inviare l'evento a Kafka",
    });
  }
});

app.post("/api/v1/startSmartWatchPodSimulator", async (req, res) => {
  try {
    const patch = [{ op: "replace", path: "/spec/replicas", value: 1 }];
    await k8sApi.patchNamespacedDeployment({
      name: "smartwatch-simulator",
      namespace: kubernetesNamespace,
      body: patch,
    });
    res.status(200).json({
      success: true,
      message: "Simulatore SmartWatch Pod avviato",
    });
  } catch (error) {
    const message = getKubernetesErrorMessage(error);
    console.error("Errore avviando il simulatore SmartWatch Pod:", message);
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

app.post("/api/v1/stopSmartWatchPodSimulator", async (req, res) => {
  try {
    const patch = [{ op: "replace", path: "/spec/replicas", value: 0 }];
    await k8sApi.patchNamespacedDeployment({
      name: "smartwatch-simulator",
      namespace: kubernetesNamespace,
      body: patch,
    });
    res.status(200).json({
      success: true,
      message: "Simulatore SmartWatch Pod fermato",
    });
  } catch (error) {
    const message = getKubernetesErrorMessage(error);
    console.error("Errore fermando il simulatore SmartWatch Pod:", message);
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

// ============================ AVVIO ===============================

async function start() {
  app.listen(context.port, () => {
    console.log(`Backend API listening on http://localhost:${context.port}`);
  });
}

start().catch(console.error);

process.on("SIGINT", async () => {
  if (producerConnected) {
    await producer.disconnect();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  if (producerConnected) {
    await producer.disconnect();
  }
  process.exit(0);
});
