# BigIntensive su k3s

Questa cartella contiene la base Kubernetes per avviare BigIntensive su k3s senza passare da Docker Compose.

Per i dettagli tecnici dei manifest (ownership, ordine completo, checklist cambi), vedi [MANIFESTS.md](MANIFESTS.md).

Il cluster gestisce:

- `backend`
- `frontend`
- `postgres`
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
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="agent --node-name <NODE_NAME>" K3S_URL=https://<SERVER_IP>:6443 K3S_TOKEN='<TOKEN>' sh -
```

Nel caso specifico:

```bash
#TOKEN
K10f8eed66f2b617a72eb273c752e47b1e9f81f0132219beec50ec42101b25d6dd0::server:926a3320a8d2afe48113eb997039ce7c
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

## Topologia distribuita prevista

Il cluster target usa 3 PC fisici, ognuno registrato come nodo K3s:

```text
PC 1: K3s server/control-plane + workload
PC 2: K3s agent/worker + workload
PC 3: K3s agent/worker + workload
```

La composizione dei servizi distribuiti prevista è:

```text
Kafka
  3 broker/controller in modalità KRaft, uno per nodo
  replication factor dei topic: 3
  min.insync.replicas: 2
  KRaft coordina Kafka; non viene usato ZooKeeper

ClickHouse
  4 pod server: 2 shard x 2 repliche
  ClickHouse Keeper: 3 pod, uno per nodo
  tabelle locali ReplicatedMergeTree
  tabelle Distributed per l'accesso all'intero cluster

Spark
  modalità native Kubernetes
  Jupyter può funzionare come driver per le dimostrazioni
  gli executor vengono creati da Spark su richiesta
  K3s distribuisce gli executor sui nodi disponibili
```

Nota: il bootstrap dei topic Kafka crea i nuovi topic con replication factor `3`, ma
non modifica topic già esistenti creati con replication factor `1`. Su un cluster già
popolato serve una migrazione delle assegnazioni; in sviluppo puoi usare
`RESET_NAMESPACE=true` solo se la cancellazione dei dati è accettabile.

KRaft e ClickHouse Keeper sono componenti distinti: KRaft coordina Kafka, mentre Keeper coordina le repliche ClickHouse. L'aggiunta di un quarto PC non richiede un nuovo ruolo fisso per Spark; K3s può schedulare nuovi executor sui nodi disponibili quando un job ne richiede altri.

# Concetti chiave

Il progetto nasce per girare su 3 nodi fisici. Pertanto la topologia e le configurazioni sono ottimizzate per questo scenario.
Il nodo server K3s ospita il controllo del cluster e può anche eseguire workload. I nodi agent/worker ospitano solo workload. I servizi Kafka e ClickHouse sono distribuiti su tutti i nodi per garantire resilienza e performance.

Il sistema viene interconnesso tramite uno switch di rete. Tutti i nodi vengono connessi tramite cavo ethernet allo switch (senza management)
e pertanto dovranno essere configurati con IP statici. I nodi avranno un altra scheda di rete (essendo portatili wi-fi) che useranno per accedere a internet per aggiornamenti e download di pacchetti. Nonchè per simulare un accesso remoto al cluster da un PC esterno. In questo caso il nodo server K3s dovrà essere raggiungibile dall'esterno tramite il suo IP statico.

```text
sudo ip addr add <IP_STATIC_NODO>/24 dev <INTERFACE>
```

Per vedere le interfacce di rete disponibili:

```bash
ip addr show
```

Solo per virtualBox

```bash
sudo nmcli device set enp0s3 managed no
```

```bash
# Configurazione IP del master
sudo ip addr add 192.168.1.10/24 dev eth0
```

```bash
# Configurazione IP del worker-1
sudo ip addr add 192.168.1.20/24 dev eth1
```

```bash
# Configurazione IP del worker-2
sudo ip addr add 192.168.1.30/24 dev enp0s3
```

Testare poi la connettività tra i nodi con ping:

```text
ping <IP_STATIC_NODO>
```

Se si vogliono far persistere tali configurazioni bisogna usare i comandi di nmcli:

```bash
sudo nmcli device status
sudo nmcli connection down <NOME>
sudo nmcli connection delete <NOME>
sudo nmcli connection add type ethernet con-name <NOME> ifname <INTERFACE> ip4 <IP_STATIC_NODO>/24
sudo nmcli connection up <NOME>
sudo nmcli connection show

```

<br>
<br>

# Installazione su server master

Per avviare correttamente il server K3s, è necessario eseguire i seguenti passaggi:

## Creare la macchina virtuale con Ubuntu (altri sistemi operativi non sono testati).

Le informazioni per creare la macchina virtuale si riferiscono a Hyper-V e VirtualBox.
In Hyper-V, creare una nuova macchina virtuale con le seguenti impostazioni:

- Generazione 2
- Memoria: 16000 MB
- Disco rigido: 500 GB
- Scheda di rete esterna: Default Switch (Wi-fi)
- Scheda di rete intra cluster: External Virtual Switch (collegato alla rete fisica)
- Disabilitare Secure Boot
- Image ISO: Ubuntu 25.04/26.04 LTS

L'ordine di inserimento della scheda di rete influenza quale interfaccia verrà usata per tale rete. La prima inserita si chiamerà eth0 mentre la seconda eth1.

In VirtualBox, creare una nuova macchina virtuale con le seguenti impostazioni:

- Memoria: 16000 MB
- Core: 5
- Disco rigido: 500 GB
- Scheda di rete intra-cluster: Bridge (collegata alla rete fisica)
- Scheda di rete esterna: NAT
- Image ISO: Ubuntu 25.04/26.04 LTS

L'ordine di inserimento della scheda di rete influenza quale interfaccia verrà usata per tale rete. La prima inserita si chiamerà enp0s3 mentre la seconda enp0s8.

## Aggiornamento preliminare del sistema operativo:

```bash
sudo apt update && sudo apt upgrade -y
```

## Installare servizi di base

```bash
sudo apt install git ca-certificates helm -y
```

Helm è necessario per installare il Spark Operator, che gestisce i job Spark su Kubernetes. Helm è un package manager come apt o npm che permette di installare applicazioni complesse come lo Spark Operator (richiede la coordinazione di più file yaml) in maniera veloce.

## Installare K3s

```bash
curl -sfL https://get.k3s.io | sh -
```

## Copiare la repository del progetto nella home dell'utente

```bash
cd ~
git clone https://github.com/DavideFast/BigIntensive.git
```

## Avvio in locale con build immagini + import in k3s

```bash
bash k3s/deploy-k3s-local.sh
```

Se il servizio è già in esecuzione e si vuole re-buildare tutto.

```bash
RESET_NAMESPACE=true bash k3s/deploy-k3s-local.sh
```

Creare file config.yaml per il nodo server k3s:

```bash
sudo mkdir -p /etc/rancher/k3s
sudo nano /etc/rancher/k3s/config.yaml
```

Inserire il seguente contenuto, sostituendo `<IP_STATIC_NODO>` con l'IP statico del nodo server e `<INTERFACE>` con l'interfaccia di rete corretta:

```yaml
node-ip: "<IP_STATIC_NODO>"
flannel-iface: "<INTERFACE>"
```

## Recupero del token per il join dei nodi agent/worker

```bash
sudo cat /var/lib/rancher/k3s/server/node-token
```

<br>
<br>

# Installazione su server worker

La macchina virtuale deve essere configurata come il server master, con le stesse impostazioni di memoria, disco e rete.

## Installare K3s come agent/worker:

Inizializzare il nodo con il comando:

```bash
sudo apt update && sudo apt install curl -y
```

Installare K3s come agent/worker, sostituendo `<NOME_ASSEGNATO>` con un nome univoco per il nodo e `<SERVER_IP>` e `<TOKEN>` con i valori ottenuti dal server master:

```bash
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="agent --node-name <NOME_ASSEGNATO>" K3S_URL=https://<SERVER_IP>:6443 K3S_TOKEN='<TOKEN>' sh -
```

> [!WARNING]
> Bisogna aggiornare il file di configurazione del nodo:
>
> ```bash
> sudo mkdir -p /etc/rancher/k3s
> sudo nano /etc/rancher/k3s/config.yaml
> ```
>
> Dentro al file scrivere:
>
> ````yaml
> server: "https://<SERVER_IP>:6443"
> token: "<TOKEN>"
> node-ip: "<IP_STATIC_NODO>"
> flannel-iface: "<INTERFACE>"
>
> Dopo di che salvare il file e riavviare il servizio k3s-agent:
>
> ```bash
> sudo systemctl daemon-reload
> sudo systemctl restart k3s-agent
> ````

> [!TIP]
> Potrebbe essere necessario aprire delle porte sul firewall del master esponendo:
>
> - 6443 TCP per l'API server di Kubernetes (worker->master)
> - 8472 UDP per il traffico di rete tra i nodi (flannel VXLAN)
> - 10250 TCP per il kubelet (master->worker e traffico interno)
>
> Le regole vanno aggiunte direttamente tramite iptables e non tramite ufw che non è attivo di default su Ubuntu Desktop.

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

Questo installa anche il Kubeflow Spark Operator e poi applica i manifest modulari, creando namespace, secret, servizi, deployment/statefulset e schema PostgreSQL. Richiede Helm 3 sul nodo server K3s.

Il Spark Operator resta in ascolto delle risorse `SparkApplication`, ma non avvia alcun job da solo: Jupyter e altri client autorizzati possono continuare a sottomettere job solo su richiesta.

## Passo 4: controlla che i pod salgano

```powershell
kubectl get pods -n bigintensive -w
```

Aspettati inizialmente `ContainerCreating` sui servizi stateful, poi `Running` per i pod applicativi.

## Passo 5: verifica PostgreSQL

Lo StatefulSet `postgres` monta `database/postgresql/schema.sql` come script di inizializzazione. Lo script viene eseguito da PostgreSQL solo al primo avvio del volume dati.

```powershell
kubectl get statefulset postgres -n bigintensive
kubectl logs statefulset/postgres -n bigintensive
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

Se vuoi fare deploy e controlli in un solo comando:

```bash
bash k3s/validate-deploy.sh --deploy-first
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
