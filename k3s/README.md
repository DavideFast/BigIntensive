# BigIntensive su k3s

Questa cartella contiene la base Kubernetes per avviare BigIntensive su k3s senza passare da Docker Compose.

Il cluster gestisce:

- `backend-api`
- `frontend-dashboard`
- `citus-coordinator`
- `citus-worker-1`
- `citus-worker-2`
- `kafka`
- `kafka-ui`

Spark e Jupyter restano fuori da questa prima iterazione perché dipendono dal mount del workspace locale e conviene trattarli come estensione separata.

## Passo 1: verifica il cluster

Assicurati che k3s sia avviato e che `kubectl` punti al suo contesto:

```powershell
kubectl config current-context
kubectl get nodes
```

Se il contesto non e' quello giusto, selezionalo prima di continuare.

## Passo 2: prepara le immagini

Dal root del repository builda le immagini del backend e del frontend:

```powershell
docker build -f backend-api/Dockerfile -t bigintensive/backend-api:local .
docker build -f frontend-dashboard/Dockerfile -t bigintensive/frontend-dashboard:local .
```

Se il cluster e' locale e usa lo stesso motore container, le immagini devono comunque essere visibili ai nodi k3s. Hai due opzioni:

- caricarle in un registry raggiungibile dal cluster;
- importarle nel runtime del nodo k3s.

## Passo 3: applica i manifest

```powershell
kubectl apply -f k3s/bigintensive-k3s.yaml
```

Questo crea il namespace, i secret, i servizi, i deployment/statefulset e il job di bootstrap Citus.

## Passo 4: controlla che i pod salgano

```powershell
kubectl get pods -n bigintensive -w
```

Aspettati inizialmente `ContainerCreating` sui servizi stateful, poi `Running` per i pod applicativi.

## Passo 5: inizializza Citus

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

## Passo 6: esponi i servizi nel browser

Il manifest usa `traefik` come ingress class e questi host:

- `http://bigintensive.local` per il frontend
- `http://api.bigintensive.local` per il backend
- `http://kafka-ui.bigintensive.local` per Kafka UI

Devi far puntare questi nomi all'IP del nodo k3s nel file hosts della macchina da cui navighi.

## Passo 7: verifica l'app

Controlla prima la health del backend:

```powershell
kubectl port-forward -n bigintensive svc/backend-api 3001:3001
```

Poi apri:

- `http://localhost:3001/health`
- `http://bigintensive.local`
- `http://api.bigintensive.local/events`

## Cosa non e' ancora incluso

Spark e Jupyter non sono ancora nel manifest. Si possono aggiungere in un secondo passaggio, ma conviene farlo separatamente dal resto del cluster.
