# BigIntensive

Questo repository contiene l'applicazione BigIntensive e la sua infrastruttura Kubernetes-first.

La strada consigliata e' il cluster k3s in [k3s/README.md](k3s/README.md). La vecchia orchestrazione Docker Compose resta nel repository solo come riferimento storico.

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

## Avvio consigliato

Per partire con il cluster, segui la guida in [k3s/README.md](k3s/README.md).

Se vuoi solo provare l'app rapidamente senza Kubernetes, la vecchia strada Compose e' ancora presente, ma non e' piu il percorso raccomandato.

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
  kubectl port-forward -n bigintensive svc/backend-api 3001:3001
  ```

- Aprire il frontend in locale senza Ingress:

  ```powershell
  kubectl port-forward -n bigintensive svc/frontend-dashboard 5173:5173
  ```

## Inizializzare Citus

Nel cluster k3s questa parte e' automatizzata dal job `citus-bootstrap` definito in [k3s/bigintensive-k3s.yaml](k3s/bigintensive-k3s.yaml).

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
