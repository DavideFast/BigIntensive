# BigIntensive k3s Kubernetes Deployment

## Structure

Il deployment è diviso in 7 file YAML per una migliore organizzazione:

```
k3s/
├── 00-namespace-and-secrets.yaml    → Namespace, Secrets, ConfigMaps
├── 01-citus.yaml                    → Citus PostgreSQL (Coordinator + 2 Workers)
├── 02-kafka.yaml                    → Kafka KRaft + Kafka UI
├── 03-backend-api.yaml              → Backend API Deployment
├── 04-frontend-dashboard.yaml       → Frontend React Dashboard
├── 05-spark-and-jupyter.yaml        → Spark Native k8s + Jupyter
├── 06-ingress.yaml                  → Traefik Ingress Routes
├── deploy-all.sh                    → Deploy script (applica tutto in ordine)
├── README.md                         → This file
└── bigintensive-k3s.yaml (legacy)   → Old single-file manifest (deprecated)
```

## Quick Start

### 1️⃣ Deploy Everything

```bash
cd ~/BigIntensive/k3s
bash deploy-all.sh
```

Lo script applica i file nell'ordine corretto:

1. Namespace, Secrets, ConfigMaps
2. Citus PostgreSQL cluster
3. Kafka cluster
4. Backend API
5. Frontend Dashboard
6. Spark + Jupyter
7. Ingress routes

### 2️⃣ Verify Deployment

```bash
# Watch pod startup
sudo k3s kubectl get pods -n bigintensive -w

# Check service status
sudo k3s kubectl get svc -n bigintensive

# Check ingress routes
sudo k3s kubectl get ingress -n bigintensive
```

### 3️⃣ Access Services

Add to `/etc/hosts` on client machines:

```
192.168.1.X  bigintensive.local
192.168.1.X  api.bigintensive.local
192.168.1.X  kafka-ui.bigintensive.local
192.168.1.X  jupyter.bigintensive.local
```

Or access directly via IP:

```
http://192.168.1.X           → Frontend (default/fallback)
http://192.168.1.X:5173      → Frontend (port-based)
http://192.168.1.X:3001      → Backend API (port-based)
http://192.168.1.X:8080      → Kafka UI (port-based)
http://192.168.1.X:8888      → Jupyter (port-based)
```

## File Details

### 00-namespace-and-secrets.yaml (~150 lines)

**Contains:**

- Namespace `bigintensive`
- Secret with:
  - CITUS_POSTGRES_USER: postgres
  - CITUS_POSTGRES_PASSWORD: postgres
  - JUPYTER_TOKEN: changeme
- ConfigMap `bigintensive-config` with service endpoints
- ConfigMap `citus-bootstrap-scripts` with SQL initialization scripts

**Modify if:**

- You want to change database credentials
- You want to customize bootstrap SQL
- You want to add environment variables

### 01-citus.yaml (~250 lines)

**Contains:**

- Citus Coordinator StatefulSet (1 replica, 5GB storage)
- Citus Worker-1 StatefulSet (1 replica, 5GB storage)
- Citus Worker-2 StatefulSet (1 replica, 5GB storage)
- Bootstrap Job that initializes the distributed database
- Headless Services for each node

**Modify if:**

- You want to change number of workers
- You want to increase storage
- You want different Citus version (default: 12.1)

### 02-kafka.yaml (~130 lines)

**Contains:**

- Kafka StatefulSet in KRaft mode (no Zookeeper needed)
- 1 broker with controller role
- Kafka UI Deployment for visualization
- Services for internal and external access

**Modify if:**

- You want to enable replication (add more replicas)
- You want to change storage size (default: 10GB)
- You want different Kafka version (default: 3.7.0)

### 03-backend-api.yaml (~70 lines)

**Contains:**

- Backend-API Deployment
- Connected to Citus, Kafka
- Health check probes
- NodeSelector to run on server node with local images
- Service on port 3001

**Modify if:**

- You want to change image or port
- You want multiple replicas
- You want to add more environment variables

### 04-frontend-dashboard.yaml (~50 lines)

**Contains:**

- Frontend-Dashboard Deployment
- React app with Vite dev server
- NodeSelector to run on server node
- Service on port 5173
- Environment pointing to backend

**Modify if:**

- You want to change API endpoint
- You want to increase replicas
- You want to use production build

### 05-spark-and-jupyter.yaml (~220 lines)

**Contains:**

- ServiceAccount `spark` with permissions to manage pods
- ClusterRole & ClusterRoleBinding for Spark driver
- ConfigMap `spark-config` with Spark configuration
- Jupyter Deployment with:
  - PySparkNotebook image
  - PySpark pre-configured
  - Connection strings to Citus & Kafka
  - 2GB RAM request, 4GB limit
- Service on port 8888

**Modify if:**

- You want to add Python packages to Jupyter
- You want to change Spark configuration
- You want to use persistent storage for notebooks
- You want to change resource limits

### 06-ingress.yaml (~50 lines)

**Contains:**

- Traefik Ingress resource
- Default route (no Host header) → Frontend
- Named routes:
  - `bigintensive.local` → Frontend
  - `api.bigintensive.local` → Backend
  - `kafka-ui.bigintensive.local` → Kafka UI
  - `jupyter.bigintensive.local` → Jupyter

**Modify if:**

- You want to add SSL/TLS certificates
- You want to change hostnames
- You want to add more services

## Deploy Individual Components

You don't need to deploy everything. You can deploy specific components:

```bash
# Just Citus
sudo k3s kubectl apply -f 00-namespace-and-secrets.yaml
sudo k3s kubectl apply -f 01-citus.yaml

# Just Kafka
sudo k3s kubectl apply -f 00-namespace-and-secrets.yaml
sudo k3s kubectl apply -f 02-kafka.yaml

# Just Spark & Jupyter
sudo k3s kubectl apply -f 00-namespace-and-secrets.yaml
sudo k3s kubectl apply -f 05-spark-and-jupyter.yaml
sudo k3s kubectl apply -f 06-ingress.yaml
```

**Important:** Always apply `00-namespace-and-secrets.yaml` first, since other files depend on Secrets and ConfigMaps.

## Common Operations

### Check Logs

```bash
# Citus coordinator
sudo k3s kubectl logs -f citus-coordinator-0 -n bigintensive

# Jupyter
sudo k3s kubectl logs -f deployment/jupyter -n bigintensive

# Backend API
sudo k3s kubectl logs -f deployment/backend-api -n bigintensive
```

### Port Forward (for local testing)

```bash
# Forward Jupyter to localhost:8888
sudo k3s kubectl port-forward -n bigintensive svc/jupyter 8888:8888

# Forward Backend to localhost:3001
sudo k3s kubectl port-forward -n bigintensive svc/backend-api 3001:3001

# Forward Citus to localhost:5432
sudo k3s kubectl port-forward -n bigintensive svc/citus-coordinator 5432:5432
```

### Delete Everything

```bash
# Delete all resources in bigintensive namespace
sudo k3s kubectl delete namespace bigintensive

# Or delete selectively
sudo k3s kubectl delete -f 05-spark-and-jupyter.yaml
sudo k3s kubectl delete -f 04-frontend-dashboard.yaml
```

## Monitoring

### Resource Usage

```bash
# Check CPU/Memory usage
sudo k3s kubectl top pods -n bigintensive

# Check node resources
sudo k3s kubectl top nodes
```

### Pod Events

```bash
# See recent events
sudo k3s kubectl get events -n bigintensive

# Watch events in real-time
sudo k3s kubectl get events -n bigintensive -w
```

## Troubleshooting

### Pod not starting?

```bash
# Check pod status
sudo k3s kubectl describe pod <pod-name> -n bigintensive

# Check logs
sudo k3s kubectl logs <pod-name> -n bigintensive

# Check previous logs (if crashed)
sudo k3s kubectl logs <pod-name> -n bigintensive --previous
```

### Citus bootstrap failing?

```bash
# Check bootstrap job
sudo k3s kubectl describe job citus-bootstrap -n bigintensive
sudo k3s kubectl logs job/citus-bootstrap -n bigintensive

# Restart bootstrap
sudo k3s kubectl delete job citus-bootstrap -n bigintensive
sudo k3s kubectl apply -f 01-citus.yaml
```

### Ingress not routing?

```bash
# Check Ingress status
sudo k3s kubectl describe ingress -n bigintensive

# Check Traefik logs
sudo k3s kubectl logs -n kube-system -l app.kubernetes.io/name=traefik
```

## Migration from Single File

If you were using the old `bigintensive-k3s.yaml`:

```bash
# Backup old file
cp bigintensive-k3s.yaml bigintensive-k3s.yaml.backup

# Delete old deployment
sudo k3s kubectl delete -f bigintensive-k3s.yaml.backup

# Deploy with new files
bash deploy-all.sh
```

The new structure is equivalent but better organized.

## Advanced: Custom Build Images

If you want to build and use custom images:

```bash
# Build backend
cd backend-api
docker build -t bigintensive/backend-api:local .

# Import to k3s
docker save bigintensive/backend-api:local | sudo k3s ctr images import -

# Deploy
sudo k3s kubectl set image deployment/backend-api backend-api=bigintensive/backend-api:local -n bigintensive
```

## Next Steps

1. **Monitor Startup:** `sudo k3s kubectl get pods -n bigintensive -w`
2. **Access Jupyter:** Add `/etc/hosts` entries and go to `http://jupyter.bigintensive.local`
3. **Start Analytics:** Open the example notebook `01_spark_initialization.ipynb`
4. **Scale Up:** Modify replicas or add new components

Buon lavoro! 🚀
