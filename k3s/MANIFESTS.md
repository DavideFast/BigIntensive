# BigIntensive k3s Manifest Appendix

Primary runbook: [README.md](README.md)

This document is a technical appendix for the current modular Kubernetes manifests.

## Manifest map

```text
k3s/
├── 00-namespace-and-secrets.yaml
├── 01-postgresql.yaml
├── 02-kafka.yaml
├── 02b-kafka-topics.yaml
├── 03-backend.yaml
├── 04-frontend.yaml
├── 05-spark-and-jupyter.yaml
├── 06-ingress.yaml
├── 07-clickhouse.yaml
├── 08-trainingstatus-cronjob.yaml
├── 09-kafka-consumer.yaml
├── deploy-all.sh
└── deploy-k3s-local.sh
```

## Ownership by file

- `00-namespace-and-secrets.yaml`
  - Namespace, secrets and shared application ConfigMap.
- `01-postgresql.yaml`
  - PostgreSQL service, StatefulSet, persistent volume and schema init ConfigMap.
- `02-kafka.yaml`
  - Kafka (KRaft) and Kafka UI.
- `03-backend.yaml`
  - Backend deployment/service, probes, app env wiring.
- `04-frontend.yaml`
  - Frontend deployment/service and API base URL env.
- `05-spark-and-jupyter.yaml`
  - Spark RBAC and Jupyter runtime for notebooks.
- `06-ingress.yaml`
  - Traefik ingress routes for frontend, API, Kafka UI, Jupyter.
- `07-clickhouse.yaml`
  - ClickHouse and ClickHouse Keeper resources.
- `08-trainingstatus-cronjob.yaml`
  - Training status CronJob for periodic jobs.
- `09-kafka-consumer.yaml`
  - Kafka Consumer Real-Time Analysis (Kafka Streams application).
  - ConfigMap with environment variables.
  - Deployment with 2 replicas for HA.
  - Service for metrics exposure.
  - Liveness and readiness probes.

## Apply order

The expected order is fixed and implemented by `deploy-all.sh`:

1. `00-namespace-and-secrets.yaml`
2. `01-postgresql.yaml`
3. `02-kafka.yaml`
4. `02b-kafka-topics.yaml`
5. `03-backend.yaml`
6. `04-frontend.yaml`
7. `05-spark-and-jupyter.yaml`
8. `06-ingress.yaml`
9. `07-clickhouse.yaml`
10. `08-trainingstatus-cronjob.yaml`
11. `09-kafka-consumer.yaml` (requires Kafka, PostgreSQL, ClickHouse ready)

## Advanced operations

### Deploy all with cleanup strategy

```bash
# normal deploy
bash k3s/deploy-all.sh

# clean start (recreate namespace)
RESET_NAMESPACE=true bash k3s/deploy-all.sh
```

### Rebuild app images and force rollout on k3s

```bash
bash k3s/deploy-k3s-local.sh
```

### Component-only deploy

```bash
# example: update only backend
sudo k3s kubectl apply -f k3s/03-backend.yaml
sudo k3s kubectl rollout restart deployment/backend -n bigintensive
```

### Runtime checks

```bash
sudo k3s kubectl get pods -n bigintensive -w
sudo k3s kubectl get svc -n bigintensive
sudo k3s kubectl get ingress -n bigintensive
sudo k3s kubectl logs -f deployment/backend -n bigintensive
```

## Change checklist

Before changing any manifest, verify:

1. Service name and deployment name stay aligned (`backend`, `frontend`).
2. Ingress backend service names match actual services.
3. Environment variable names are consistent with app code.
4. Image tags used in manifests exist in the target runtime.
5. If node labels/selectors are used, target nodes are labeled.
