# BigIntensive Spark Infrastructure

Questa cartella contiene una infrastruttura Apache Spark locale basata su Docker Compose.

## Cosa include

- 1 Spark Master
- 2 Spark Worker
- 1 Jupyter Notebook server integrato con Spark
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

## Note

- I file locali in `spark/apps` e `spark/data` sono montati dentro i container.
- L'intera cartella `spark` e' montata in Jupyter come `/home/jovyan/work`.
- Puoi aggiungere nuovi job PySpark in `spark/apps` e lanciarli con `spark-submit`.

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
