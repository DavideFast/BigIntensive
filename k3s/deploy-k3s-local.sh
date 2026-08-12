#!/usr/bin/env bash

# This script deploys the BigIntensive application to a local k3s cluster and builds the backend and frontend Docker images,
# importing them into the k3s containerd runtime.
set -euo pipefail

NAMESPACE="bigintensive"
DEPLOY_ALL_SCRIPT="k3s/deploy-all.sh"
BACKEND_IMAGE="bigintensive/backend:local"
FRONTEND_IMAGE="bigintensive/frontend:local"
LOCAL_IMAGES_LABEL="bigintensive.io/local-images=true"

if [[ ! -f "$DEPLOY_ALL_SCRIPT" ]]; then
  echo "Script non trovato: $DEPLOY_ALL_SCRIPT"
  echo "Esegui lo script dalla root della repo BigIntensive."
  exit 1
fi

if ! command -v k3s >/dev/null 2>&1; then
  echo "k3s non trovato. Installa k3s prima di usare questo script."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker non trovato. Installo docker.io..."
  sudo apt update
  sudo apt install -y docker.io
fi

echo "Avvio Docker..."
sudo systemctl enable --now docker >/dev/null 2>&1 || true

detect_current_node_name() {
  local candidate
  local internal_ip

  for candidate in "$(hostname)" "$(hostname -s)"; do
    if [[ -n "$candidate" ]] && sudo k3s kubectl get node "$candidate" >/dev/null 2>&1; then
      echo "$candidate"
      return 0
    fi
  done

  internal_ip="$(hostname -I | awk '{print $1}')"

  if [[ -n "$internal_ip" ]]; then
    candidate="$(sudo k3s kubectl get nodes -o wide --no-headers | awk -v ip="$internal_ip" '$6 == ip { print $1; exit }')"

    if [[ -n "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  fi

  return 1
}

CURRENT_NODE_NAME="$(detect_current_node_name || true)"

if [[ -z "$CURRENT_NODE_NAME" ]]; then
  echo "Nodo k3s corrente non trovato automaticamente."
  echo "Controlla 'sudo k3s kubectl get nodes -o wide' e verifica nome nodo e IP registrati."
  exit 1
fi

echo "Etichetto il nodo $CURRENT_NODE_NAME come host per immagini locali..."
sudo k3s kubectl label node "$CURRENT_NODE_NAME" "$LOCAL_IMAGES_LABEL" --overwrite

echo "Verifica nodo k3s..."
sudo k3s kubectl get nodes

echo "Applico manifest Kubernetes modulari..."
bash "$DEPLOY_ALL_SCRIPT"

echo "Build immagine backend..."
sudo docker build -f services/backend/Dockerfile -t "$BACKEND_IMAGE" services/backend

echo "Build immagine frontend..."
sudo docker build -f services/frontend/Dockerfile -t "$FRONTEND_IMAGE" services/frontend

echo "Import immagini in containerd di k3s..."
sudo docker save "$BACKEND_IMAGE" | sudo k3s ctr -n k8s.io images import -
sudo docker save "$FRONTEND_IMAGE" | sudo k3s ctr -n k8s.io images import -

echo "Verifica immagini importate (namespace k8s.io)..."
sudo k3s ctr -n k8s.io images ls | grep -E 'bigintensive/(backend|frontend).*local' || {
  echo "Immagini non trovate nel namespace containerd k8s.io."
  exit 1
}

echo "Riavvio deployment applicativi..."
sudo k3s kubectl rollout restart deployment/backend -n "$NAMESPACE"
sudo k3s kubectl rollout restart deployment/frontend -n "$NAMESPACE"

echo "Stato pod nel namespace $NAMESPACE:"
sudo k3s kubectl get pods -n "$NAMESPACE"

echo "Fatto."
