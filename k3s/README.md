# BigIntensive su k3s

Questa cartella contiene la base Kubernetes per portare su k3s la parte core di BigIntensive:

- `backend-api`
- `frontend-dashboard`
- `citus-coordinator`
- `citus-worker-1`
- `citus-worker-2`
- `kafka`
- `kafka-ui`

Spark e Jupyter restano fuori da questa prima iterazione perché dipendono dal mount del workspace locale e conviene trattarli come estensione separata.

## Passo 1: prepara le immagini

Dal root del repository builda le immagini locali del backend e del frontend:

```powershell
docker build -f backend-api/Dockerfile -t bigintensive/backend-api:local .
docker build -f frontend-dashboard/Dockerfile -t bigintensive/frontend-dashboard:local .
```

Se il tuo k3s gira su una macchina diversa, devi poi pubblicare queste immagini in un registry accessibile dal cluster, oppure importarle nel containerd del nodo k3s.

## Passo 2: applica i manifest

```powershell
kubectl apply -f k3s/bigintensive-k3s.yaml
```

Questo crea il namespace, i secret, i servizi, i deployment/statefulset e il job di bootstrap Citus.

## Passo 3: controlla che i pod salgano

```powershell
kubectl get pods -n bigintensive -w
```

Aspettati inizialmente `ContainerCreating` sui servizi stateful, poi `Running` per i pod applicativi.

## Passo 4: inizializza Citus

Il job `citus-bootstrap` applica gli script SQL che il progetto già usa in locale.

Per vedere l'esito:

```powershell
kubectl logs job/citus-bootstrap -n bigintensive
```

Se vuoi rilanciarlo dopo una modifica ai dati, cancellalo e riapplicalo:

```powershell
kubectl delete job citus-bootstrap -n bigintensive
kubectl apply -f k3s/bigintensive-k3s.yaml
```

## Passo 5: esponi i servizi nel browser

Il manifest usa `traefik` come ingress class e questi host:

- `http://bigintensive.local` per il frontend
- `http://api.bigintensive.local` per il backend
- `http://kafka-ui.bigintensive.local` per Kafka UI

Devi far puntare questi nomi all'IP del nodo k3s nel file hosts della macchina da cui navighi.

## Passo 6: verifica l'app

Controlla prima la health del backend:

```powershell
kubectl port-forward -n bigintensive svc/backend-api 3001:3001
```

Poi apri:

- `http://localhost:3001/health`
- `http://bigintensive.local`
- `http://api.bigintensive.local/events`

## Step successivo opzionale

Se vuoi, nel prossimo passaggio aggiungo anche la parte Spark/Jupyter in k3s con un approccio separato, così non mescoliamo il runtime Kubernetes con il mount del workspace locale.
