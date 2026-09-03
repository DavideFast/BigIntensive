import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { createSystemRouter } from "./routes/systemRoutes.js";
import { createServerContext } from "./bootstrap/serverContext.js";
import { createClickhouseClient } from "./db/pool.js";
import { Kafka } from "kafkajs";
import { AppsV1Api, BatchV1Api, KubeConfig } from "@kubernetes/client-node";

// ============================ CONFIGURAZIONE ===============================

// Configurazione del client Kubernetes
const kubeConfig = new KubeConfig();
kubeConfig.loadFromDefault();
const k8sApi = kubeConfig.makeApiClient(AppsV1Api);
const k8sBatchApi = kubeConfig.makeApiClient(BatchV1Api);
const kubernetesNamespace = process.env.KUBERNETES_NAMESPACE || "bigintensive";
const eltCronJobName = "elt-copy-workout";
const runningPopulationJobName = "running-population-analysis";

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
  const query = "SELECT * FROM allenamenti WHERE athlete_id = 1 LIMIT 10";
  context.pool.query(query, (err, result) => {
    if (err) {
      console.error("Errore query PostgreSQL:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
    console.log("Dati letti da PostgreSQL:", result.rows);
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
  const query = `INSERT INTO allenamenti (athlete_id, data_allenamento, tipo_allenamento, durata_minuti, struttura_allenamento)
                 VALUES ($1, $2, $3, $4, $5)`;
  const values = [1, "2026-08-15", "forza", 75, JSON.stringify(allenamento)];
  context.pool.query(query, values, (err, result) => {
    if (err) {
      console.error("Errore query PostgreSQL:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true });
  });
});

app.get("/api/v1/readClickhouse", async (req, res) => {
  console.log("Leggo da : " + process.env.CLICKHOUSE_HOST + ":" + process.env.CLICKHOUSE_PORT);
  console.log("Leggo da ClickHouse con utente: " + process.env.CLICKHOUSE_USER);
  console.log("Leggo da ClickHouse con database: " + process.env.CLICKHOUSE_DATABASE);
  console.log("Leggo da ClickHouse con url: " + (process.env.CLICKHOUSE_URL ? "****" : "(vuota)"));
  console.log("Leggo da ClickHouse con formato: JSONEachRow");
  const query_grande = "SELECT * FROM bigintensive.running_samples WHERE session_id = ";
  const query_media = "(SELECT session_id FROM bigintensive.running_samples WHERE athlete_id = () LIMIT 1)";
  const query_piccola = "(SELECT athlete_id FROM bigintensive.running_samples LIMIT 1)";
  const query = query_grande + query_media.replace("()", query_piccola);
  try {
    const valore = await createClickhouseClient.query({
      query: query,
      format: "JSONEachRow",
    });
    const data = await valore.json();
    console.log("Dati letti da ClickHouse:", data);
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
      messages: [{ key: req.body.athlete_id.toString() + "-" + req.body.session_id.toString(), value: JSON.stringify(req.body) }],
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

app.post("/api/v1/startELTProcess", async (req, res) => {
  try {
    const cronJob = await k8sBatchApi.readNamespacedCronJob({
      name: eltCronJobName,
      namespace: kubernetesNamespace,
    });

    await k8sBatchApi.patchNamespacedCronJob({
      name: eltCronJobName,
      namespace: kubernetesNamespace,
      body: [{ op: "add", path: "/spec/suspend", value: false }],
    });

    // I job manuali bypassano concurrencyPolicy del CronJob: evitiamo run sovrapposti.
    const existingJobs = await k8sBatchApi.listNamespacedJob({
      namespace: kubernetesNamespace,
      labelSelector: `app=${eltCronJobName}`,
    });

    const runningJob = existingJobs.items.find((job) => (job.status?.active || 0) > 0);

    if (runningJob) {
      return res.status(200).json({
        success: true,
        message: `Processo ELT gia' in esecuzione (${runningJob.metadata.name})`,
      });
    }

    await k8sBatchApi.createNamespacedJob({
      namespace: kubernetesNamespace,
      body: {
        apiVersion: "batch/v1",
        kind: "Job",
        metadata: {
          generateName: `${eltCronJobName}-manual-`,
          labels: cronJob.metadata?.labels,
        },
        spec: {
          ...cronJob.spec.jobTemplate.spec,
          // I job con generateName non rientrano negli history limit del CronJob.
          ttlSecondsAfterFinished: 1800,
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Processo ELT avviato immediatamente",
    });
  } catch (error) {
    const message = getKubernetesErrorMessage(error);
    console.error("Errore avviando il processo ELT:", message);
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

app.post("/api/v1/stopELTProcess", async (req, res) => {
  try {
    await k8sBatchApi.patchNamespacedCronJob({
      name: eltCronJobName,
      namespace: kubernetesNamespace,
      body: [{ op: "add", path: "/spec/suspend", value: true }],
    });
    await k8sBatchApi.deleteCollectionNamespacedJob({
      namespace: kubernetesNamespace,
      labelSelector: "app=elt-copy-workout",
      propagationPolicy: "Background",
    });
    res.status(200).json({
      success: true,
      message: "Processo ELT fermato",
    });
  } catch (error) {
    const message = getKubernetesErrorMessage(error);
    console.error("Errore fermando il processo ELT:", message);
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

app.post("/api/v1/startRunningPopulation", async (req, res) => {
  try {
    const existingJobs = await k8sBatchApi.listNamespacedJob({
      namespace: kubernetesNamespace,
      labelSelector: `app=${runningPopulationJobName}`,
    });

    const finishedJobs = existingJobs.items.filter(
      (job) => job.status?.completionTime || job.status?.failed,
    );
    await Promise.all(
      finishedJobs.map((job) =>
        k8sBatchApi.deleteNamespacedJob({
          name: job.metadata.name,
          namespace: kubernetesNamespace,
          propagationPolicy: "Background",
        }),
      ),
    );

    const runningJob = existingJobs.items.find((job) => (job.status?.active || 0) > 0);
    if (runningJob) {
      return res.status(200).json({
        success: true,
        jobName: runningJob.metadata.name,
        message: `RunningPopulation gia' in esecuzione (${runningJob.metadata.name})`,
      });
    }

    const jobName = `${runningPopulationJobName}-${Date.now()}`;
    await k8sBatchApi.createNamespacedJob({
      namespace: kubernetesNamespace,
      body: {
        apiVersion: "batch/v1",
        kind: "Job",
        metadata: {
          name: jobName,
          labels: {
            app: runningPopulationJobName,
          },
        },
        spec: {
          backoffLimit: 0,
          ttlSecondsAfterFinished: 1800,
          template: {
            metadata: {
              labels: {
                app: runningPopulationJobName,
              },
            },
            spec: {
              serviceAccountName: "spark",
              restartPolicy: "Never",
              containers: [
                {
                  name: runningPopulationJobName,
                  image: "davidefast/bigintensive-sparkwithdependencies:latest",
                  imagePullPolicy: "Always",
                  command: ["/opt/spark/bin/spark-submit"],
                  args: [
                    "--master",
                    "k8s://https://kubernetes.default:443",
                    "--deploy-mode",
                    "client",
                    "--name",
                    "running-population-analysis",
                    "--conf",
                    "spark.kubernetes.namespace=bigintensive",
                    "--conf",
                    "spark.kubernetes.authenticate.driver.serviceAccountName=spark",
                    "--conf",
                    "spark.kubernetes.container.image=davidefast/bigintensive-sparkwithdependencies:latest",
                    "--conf",
                    "spark.kubernetes.executor.deleteOnTermination=false",
                    "--conf",
                    "spark.dynamicAllocation.enabled=false",
                    "--conf",
                    "spark.executor.instances=2",
                    "--conf",
                    "spark.executor.cores=2",
                    "--conf",
                    "spark.executor.memory=2g",
                    "--conf",
                    "spark.driver.bindAddress=0.0.0.0",
                    "--conf",
                    "spark.driver.port=4040",
                    "--py-files",
                    "/opt/jobs/config.py",
                    "/opt/jobs/RunningPopolationAnalysis.py",
                  ],
                  envFrom: [{ configMapRef: { name: "bigintensive-config" } }, { secretRef: { name: "bigintensive-secrets" } }],
                  env: [
                    {
                      name: "KUBERNETES_NAMESPACE",
                      valueFrom: { fieldRef: { fieldPath: "metadata.namespace" } },
                    },
                  ],
                  volumeMounts: [{ name: "running-population-scripts", mountPath: "/opt/jobs", readOnly: true }],
                },
              ],
              volumes: [
                {
                  name: "running-population-scripts",
                  configMap: { name: "running-population-job-script" },
                },
              ],
            },
          },
        },
      },
    });
    res.status(200).json({
      success: true,
      jobName,
      message: "Job RunningPopulation avviato",
    });
  } catch (error) {
    const message = getKubernetesErrorMessage(error);
    console.error("Errore avviando lo Spark job:", message);
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

// ============================ START SERVER ===============================

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
