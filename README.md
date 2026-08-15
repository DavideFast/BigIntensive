# BigIntensive

Questo repository contiene l'applicazione BigIntensive e la sua infrastruttura Kubernetes-first.

La strada consigliata e' il cluster k3s in [k3s/README.md](k3s/README.md). La vecchia orchestrazione Docker Compose resta nel repository solo come riferimento storico.

## What is FitnessHub

This prokect aim to simulate a fitness application that permit to store workout sessions and running sessions. Every choice has been made considering an a
application with 500'000+ users.
This project is composed by the following components:

- k3s cluster as orchestrator
- React frontend
- Express backend
- Postgresql database
- Clickhouse database
- Kafka message broker
- Spark streaming jobs
- Jupyter notebook for data analysis
- Other scripts for testing and data generation

## Architettura rapida

```mermaid
flowchart LR
  FE[Frontend\nservices/frontend] -->|HTTP| BE[Backend\nservices/backend]
  BE -->|events| KAFKA[Kafka]
  BE -->|OLTP queries| CITUS[Citus]
  SPARK[Spark Jobs] -->|read/write| KAFKA
  SPARK -->|analytics| CITUS
  JUPYTER[Jupyter] -->|notebook dev| SPARK
```

- Il frontend parla con il backend via `VITE_API_BASE_URL`.
- Il backend gestisce API, produce/consuma eventi e scrive dati applicativi.
- Spark elabora stream/eventi e supporta analisi batch/interactive via Jupyter.

## Quale percorso usare

- Deploy completo k3s (raccomandato): `bash k3s/deploy-all.sh`
- Deploy locale con build immagini + import in k3s: `bash k3s/deploy-k3s-local.sh`
- Solo sviluppo locale rapido: `dev/docker-compose.yml`
- Diagnostica k3s: `kubectl get all -n bigintensive` e `kubectl get ingress -n bigintensive`

## Artefatti generati

- `services/frontend/dist` e' output di build (non sorgente): puo' essere eliminata e rigenerata con `npm run build`.
- `services/*/node_modules` e i dati runtime in `database/` e `streaming/kafka/data` non vanno versionati.

## Avvio consigliato

Per partire con il cluster, segui la guida in [k3s/README.md](k3s/README.md).

Se vuoi solo provare l'app rapidamente senza Kubernetes, la vecchia strada Compose e' ancora presente, ma non e' piu il percorso raccomandato.

Il file Compose locale si trova in `dev/docker-compose.yml`.

## Comandi utili

- Aprire il cluster k3s da terminale:

  ```powershell
  kubectl get nodes
  kubectl get pods -A
  ```

- Vedere i workload del progetto:

  ```powershell
  kubectl get all -n bigintensive
  ```

- Vedere i log del bootstrap Citus:

  ```powershell
  kubectl logs job/citus-bootstrap -n bigintensive
  ```

- Aprire il backend in locale senza Ingress:

  ```powershell
  kubectl port-forward -n bigintensive svc/backend 3001:3001
  ```

- Aprire il frontend in locale senza Ingress:

  ```powershell
  kubectl port-forward -n bigintensive svc/frontend 5173:5173
  ```

## Inizializzare Citus

Nel cluster k3s questa parte e' automatizzata dal job `citus-bootstrap` definito nei manifest modulari in `k3s/` (in particolare `k3s/01-citus.yaml`).

## Collegare Spark a Citus via JDBC

Esempio di connessione dal notebook/job Spark:

```python
jdbc_url = "jdbc:postgresql://citus-coordinator:5432/bigintensive"

properties = {
  "user": "postgres",
  "password": "postgres",
  "driver": "org.postgresql.Driver"
}

df = spark.read.jdbc(url=jdbc_url, table="public.my_table", properties=properties)
```

## Usare Kafka

Nel cluster Kafka e Kafka UI sono gestiti dai manifest k3s e risultano disponibili tramite i relativi servizi interni e Ingress.

Se vuoi, puoi usare `kubectl exec` nel pod Kafka per creare topic e produrre messaggi.

- http://localhost:8088

## Integrare Kafka nell'app (Python)

1. Installa dipendenze Python:

```powershell
python -m pip install -r .\services\backend\scripts\requirements.txt
```

2. Configura endpoint Kafka per app host:

```powershell
$env:KAFKA_BOOTSTRAP_SERVERS = "localhost:9094"
$env:KAFKA_TOPIC = "demo-events"
```

3. Invia un evento (producer):

```powershell
python .\services\backend\scripts\producer.py --topic demo-events --message "utente registrato" --as-json
```

4. Leggi eventi (consumer):

```powershell
python .\services\backend\scripts\consumer.py --topic demo-events --group-id app-consumer --from-beginning --max-messages 10
```

Nota: se esegui il codice Python dentro un container nella rete Docker, usa `kafka:9092` come bootstrap server invece di `localhost:9094`.

## Note

- I job Spark locali sono montati da `streaming/spark/jobs` dentro i container.
- L'intera cartella `streaming/spark` e' montata in Jupyter come `/home/jovyan/work`.
- Puoi aggiungere nuovi job PySpark in `streaming/spark/jobs` e lanciarli con `spark-submit`.
- I dati PostgreSQL/Citus restano persistenti nelle cartelle `database/postgres/*-data`.
- I dati Kafka restano persistenti nella cartella `streaming/kafka/data`.

## Dashboard React

- Path progetto: `services/frontend`
- URL sviluppo: `http://localhost:5173`
- Endpoint API configurabili in `services/frontend/.env.example`:
  - `VITE_API_BASE_URL`
  - `VITE_EVENTS_PATH`

Se l'API non e' ancora disponibile, il dashboard mostra automaticamente dati mock locali per facilitare lo sviluppo UI.

## Backend Express

- Path progetto: `services/backend`
- URL sviluppo: `http://localhost:3001`
- Endpoint principali:
  - `GET /health`
  - `GET /events`
  - `POST /events`
  - `DELETE /events`

Esempio richiesta POST:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3001/events -ContentType "application/json" -Body '{"topic":"demo-events","source":"manual-test","status":"queued","payload":"ciao"}'
```

## Usare Spark da Notebook

Nel notebook usa una sessione Spark puntata al master del cluster:

```python
from pyspark.sql import SparkSession

spark = (
  SparkSession.builder
  .appName("notebook-session")
  .master("spark://spark-master:7077")
  .getOrCreate()
)

spark.read.text("/home/jovyan/work/jobs/consumer.py").show(truncate=False)
```
