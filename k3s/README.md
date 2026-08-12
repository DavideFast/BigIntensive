# BigIntensive su k3s

Questa cartella contiene la base Kubernetes per avviare BigIntensive su k3s senza passare da Docker Compose.

Per i dettagli tecnici dei manifest (ownership, ordine completo, checklist cambi), vedi [MANIFESTS.md](MANIFESTS.md).

Il cluster gestisce:

- `backend`
- `frontend`
- `citus-coordinator`
- `citus-worker-1`
- `citus-worker-2`
- `kafka`
- `kafka-ui`

## Passo 1: verifica il cluster

Assicurati che k3s sia avviato e che `kubectl` punti al suo contesto:

```powershell
kubectl config current-context
kubectl get nodes
```

Se il contesto non e' quello giusto, selezionalo prima di continuare.

## Passo 1b: aggiungi la seconda VM come agent

Se stai usando due VM Ubuntu in bridge, installa `k3s server` solo sulla VM principale e collega la seconda VM come `k3s agent`.

Sulla VM principale recupera token e IP del server:

```bash
sudo cat /var/lib/rancher/k3s/server/node-token
hostname -I
```

Sulla seconda VM installa l'agent sostituendo `<SERVER_IP>` e `<TOKEN>`:

```bash
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="agent --with-node-id" K3S_URL=https://<SERVER_IP>:6443 K3S_TOKEN='<TOKEN>' sh -
```

`--with-node-id` evita conflitti se il cluster ha gia' visto in passato lo stesso hostname della seconda VM.

Se stai rifacendo il join dopo tentativi falliti, sulla seconda VM conviene pulire prima lo stato locale:

```bash
sudo /usr/local/bin/k3s-agent-uninstall.sh
sudo rm -rf /etc/rancher /var/lib/rancher /var/lib/kubelet
sudo systemctl daemon-reload
```

Se sul server compare gia' un vecchio nodo della seconda VM, rimuovilo prima di riprovare:

```bash
sudo kubectl get nodes -o wide
sudo kubectl delete node <OLD_NODE_NAME>
```

Poi verifica dal server che entrambi i nodi siano presenti:

```bash
sudo kubectl get nodes -o wide
```

Nota pratica: nel setup attuale backend e frontend usano immagini locali (`bigintensive/...:local`). Lo script `k3s/deploy-k3s-local.sh` etichetta automaticamente il nodo server e forza quei due deployment a restare li'. Questo evita errori `ImagePullBackOff` sul nodo agent finche' non configuri un registry condiviso.

## Passo 2: prepara le immagini

Dal root del repository builda le immagini del backend e del frontend:

```powershell
docker build -f services/backend/Dockerfile -t bigintensive/backend:local services/backend
docker build -f services/frontend/Dockerfile -t bigintensive/frontend:local services/frontend
```

Se il cluster e' locale e usa lo stesso motore container, le immagini devono comunque essere visibili ai nodi k3s. Hai due opzioni:

- caricarle in un registry raggiungibile dal cluster;
- importarle nel runtime del nodo k3s.

In alternativa, dalla root della repo puoi usare lo script automatico:

```bash
chmod +x k3s/deploy-k3s-local.sh
./k3s/deploy-k3s-local.sh
```

`chmod +x` serve solo a rendere eseguibile il file `.sh` su Linux. In alternativa puoi lanciarlo senza cambiare permessi:

```bash
bash k3s/deploy-k3s-local.sh
```

Lo script applica i manifest, builda backend/frontend, importa le immagini in k3s e riavvia i deployment app.

Nel caso a due VM, esegui questo script sulla VM server, non sull'agent.

## Passo 3: applica i manifest

```powershell
bash k3s/deploy-all.sh
```

Questo applica i manifest modulari e crea namespace, secret, servizi, deployment/statefulset e job di bootstrap Citus.

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
kubectl apply -f k3s/01-citus.yaml
```

## Passo 6: esponi i servizi nel browser

Il manifest usa `traefik` come ingress class e questi host:

- `http://bigintensive.local` per il frontend
- `http://api.bigintensive.local` per il backend
- `http://kafka-ui.bigintensive.local` per Kafka UI

Devi far puntare questi nomi all'IP del nodo k3s nel file hosts della macchina da cui navighi.

Se navighi da entrambe le macchine host, aggiorna il file hosts su entrambe con l'IP della VM server.

Esempio file hosts:

```text
192.168.1.50 bigintensive.local
192.168.1.50 api.bigintensive.local
192.168.1.50 kafka-ui.bigintensive.local
```

Aprire direttamente `http://192.168.1.50` non basta, perche' l'Ingress instrada in base all'hostname richiesto.

## Passo 7: verifica l'app

Per un controllo automatico rapido di stato deploy, rollout e servizi:

```bash
bash k3s/validate-deploy.sh
```

Controlla prima la health del backend:

```powershell
kubectl port-forward -n bigintensive svc/backend 3001:3001
```

Poi apri:

- `http://localhost:3001/health`
- `http://bigintensive.local`
- `http://api.bigintensive.local/events`

## Troubleshooting rapido

- Se il join della seconda VM fallisce con errori sui CA, verifica prima l'endpoint giusto del server:

  ```bash
  curl -vk https://<SERVER_IP>:6443/cacerts
  ```

- Se compare `node password rejected`, ripulisci l'agent e rilancia il join con `--with-node-id`.

- Se il browser mostra `Blocked request. This host is not allowed`, aggiorna la repo sulla VM server e rilancia `bash k3s/deploy-k3s-local.sh` per ricostruire il frontend con la configurazione Vite aggiornata.

- Per controllare dove stanno girando i pod nel cluster a due nodi:

  ```bash
  sudo kubectl get nodes -o wide
  sudo kubectl get pods -n bigintensive -o wide
  ```

Per operazioni avanzate (deploy selettivo componenti, runtime checks estesi, checklist modifiche), vedi [MANIFESTS.md](MANIFESTS.md).
