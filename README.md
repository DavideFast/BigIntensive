# BigIntensive Spark Infrastructure

Questa cartella contiene una infrastruttura locale Spark + Citus + Kafka basata su Docker Compose.

## Cosa include

- 1 Spark Master
- 2 Spark Worker
- 1 Jupyter Notebook server integrato con Spark
- 1 Citus Coordinator (PostgreSQL distribuito)
- 2 Citus Worker
- 1 Kafka broker (KRaft)
- 1 Kafka UI
- 1 Backend Express leggero (API eventi)
- Notebook iniziale: `spark/notebooks/quickstart.ipynb`
- Esempio PySpark (`spark/apps/wordcount.py`)
- Dataset di test (`spark/data/input.txt`)

## Prerequisiti

- Docker Desktop installato
- Docker Compose v2 (comando `docker compose`)

## Avvio rapido

1. Copia il file ambiente:

   ```bash
   cp .env.example .env
   ```

   Su Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Avvia il cluster:

   ```bash
   docker compose up -d
   ```

3. Verifica le UI:

- Master UI: http://localhost:8080
- Worker 1 UI: http://localhost:8081
- Worker 2 UI: http://localhost:8082
- Jupyter: http://localhost:8888 (token in `.env`)
- Citus coordinator: localhost:55432 (oppure la porta impostata in `CITUS_COORDINATOR_PORT`)
- Citus worker 1: localhost:5433
- Citus worker 2: localhost:5434
- Kafka broker (host): localhost:9094
- Kafka UI: http://localhost:8088
- Backend API: http://localhost:3001

Apri in Jupyter il notebook:

- `work/notebooks/quickstart.ipynb`

4. Esegui il job di esempio:

   ```bash
   docker compose exec spark-master spark-submit \
     --master spark://spark-master:7077 \
     /opt/spark-apps/wordcount.py
   ```

   Su Windows PowerShell (senza backslash):

   ```powershell
   docker compose exec spark-master spark-submit --master spark://spark-master:7077 /opt/spark-apps/wordcount.py
   ```

## Comandi utili

- Avviare tutta la piattaforma (Spark + Jupyter + Citus + Kafka). Se manca, crea anche `.env` dalla `.env.example`:

  ```powershell
  .\scripts\start-all.ps1
  ```

- Avviare anche backend e dashboard insieme alla piattaforma:

  ```powershell
  .\scripts\start-all.ps1 -IncludeApp
  ```

- Avviare tutto senza inizializzare Citus:

  ```powershell
  .\scripts\start-all.ps1 -SkipCitusInit
  ```

- Avviare il dashboard React dati:

  ```powershell
  .\scripts\start-dashboard.ps1
  ```

- Avviare backend Express API:

  ```powershell
  .\scripts\start-backend.ps1
  ```

- Aprire i log di Jupyter:

  ```bash
  docker compose logs -f jupyter
  ```

- Aprire una shell nel container Jupyter:

  ```bash
  docker compose exec jupyter bash
  ```

- Fermare il cluster:

  ```bash
  docker compose down
  ```

- Vedere i log:

  ```bash
  docker compose logs -f
  ```

- Scalare i worker (esempio a 3):

  ```bash
  docker compose up -d --scale spark-worker-1=2 --scale spark-worker-2=1
  ```

## Inizializzare Citus

1. Avvia solo i servizi database (opzionale, se non hai gia fatto `docker compose up -d`):

```bash
docker compose up -d citus-coordinator citus-worker-1 citus-worker-2
```

2. Inizializza extension e registrazione nodi worker:

```powershell
.\scripts\init-citus.ps1
```

3. Verifica i nodi dal coordinator:

```bash
docker compose exec citus-coordinator psql -U postgres -d bigintensive -c "SELECT nodename, nodeport, noderole FROM pg_dist_node;"
```

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

1. Avvia Kafka e UI (opzionale, se non hai gia fatto `docker compose up -d`):

```bash
docker compose up -d kafka kafka-ui
```

2. Crea un topic di test:

```bash
docker compose exec kafka /opt/bitnami/kafka/bin/kafka-topics.sh --create --if-not-exists --topic demo-events --bootstrap-server kafka:9092 --partitions 3 --replication-factor 1
```

3. Produci un messaggio:

```bash
echo "hello from bigintensive" | docker compose exec -T kafka /opt/bitnami/kafka/bin/kafka-console-producer.sh --topic demo-events --bootstrap-server kafka:9092
```

4. Consuma un messaggio:

```bash
docker compose exec kafka /opt/bitnami/kafka/bin/kafka-console-consumer.sh --topic demo-events --bootstrap-server kafka:9092 --from-beginning --max-messages 1
```

5. Apri Kafka UI:

- http://localhost:8088

## Integrare Kafka nell'app (Python)

1. Installa dipendenze Python:

```powershell
python -m pip install -r .\scripts\python\requirements.txt
```

2. Configura endpoint Kafka per app host:

```powershell
$env:KAFKA_BOOTSTRAP_SERVERS = "localhost:9094"
$env:KAFKA_TOPIC = "demo-events"
```

3. Invia un evento (producer):

```powershell
python .\scripts\python\producer.py --topic demo-events --message "utente registrato" --as-json
```

4. Leggi eventi (consumer):

```powershell
python .\scripts\python\consumer.py --topic demo-events --group-id app-consumer --from-beginning --max-messages 10
```

Nota: se esegui il codice Python dentro un container nella rete Docker, usa `kafka:9092` come bootstrap server invece di `localhost:9094`.

## Note

- I file locali in `spark/apps` e `spark/data` sono montati dentro i container.
- L'intera cartella `spark` e' montata in Jupyter come `/home/jovyan/work`.
- Puoi aggiungere nuovi job PySpark in `spark/apps` e lanciarli con `spark-submit`.
- I dati PostgreSQL/Citus restano persistenti nelle cartelle `postgres/*-data`.
- I dati Kafka restano persistenti nella cartella `kafka/data`.

## Dashboard React

- Path progetto: `frontend-dashboard`
- URL sviluppo: `http://localhost:5173`
- Endpoint API configurabili in `frontend-dashboard/.env.example`:
  - `VITE_API_BASE_URL`
  - `VITE_EVENTS_PATH`

Se l'API non e' ancora disponibile, il dashboard mostra automaticamente dati mock locali per facilitare lo sviluppo UI.

## Backend Express

- Path progetto: `backend-api`
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

spark.read.text("/home/jovyan/work/data/input.txt").show(truncate=False)
```
