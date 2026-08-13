# BigIntensive - Dev startup

Questa cartella contiene gli script per avviare il progetto in locale con Docker Compose.

## Sequenza consigliata

1. Avvia l’infrastruttura completa

```powershell
cd "d:\Programmazione\GitHub\BigIntensive"
.\dev\scripts\'00 - start-all.ps1'
```

2. Verifica / crea i topic Kafka locali

```powershell
cd "d:\Programmazione\GitHub\BigIntensive"
.\dev\scripts\'01 - create-kafka-topics-local.ps1'
```

3. Avvia il backend

```powershell
cd "d:\Programmazione\GitHub\BigIntensive"
.\dev\scripts\'02 - start-backend.ps1'
```

4. Avvia il dashboard frontend

```powershell
cd "d:\Programmazione\GitHub\BigIntensive"
.\dev\scripts\'03 - start-dashboard.ps1'
```

## Script utili

- `00 - start-all.ps1`: startup completo del stack locale
- `01 - create-kafka-topics-local.ps1`: crea i topic Kafka definiti in `streaming/kafka/topics.json`
- `02 - start-backend.ps1`: avvia Express API
- `03 - start-dashboard.ps1`: avvia il frontend React
- `not-launch-init-citus.ps1`: inizializzazione manuale del database Citus, da usare solo in casi specifici

## Test e diagnostica

Dopo che il sistema è partito puoi usare:

- `kafka-smoke-test.ps1`
- `test-athletes-api.ps1`
- `run-loadtest.ps1`
- `run-wordcount.ps1`
- `stress-backend.ps1`

## Ambiente k3s

Per il deployment reale in Kubernetes, usa invece i manifest in `k3s/`.

- `k3s/02-kafka.yaml` per il broker Kafka e la UI
- `k3s/02b-kafka-topics.yaml` per il bootstrap automatico dei topic
- `k3s/deploy-all.sh` per il deploy completo
