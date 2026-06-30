#!/usr/bin/env bash

set -euo pipefail

NAMESPACE="bigintensive"
MANIFEST_PATH="k3s/bigintensive-k3s.yaml"
BACKEND_IMAGE="bigintensive/backend-api:local"
FRONTEND_IMAGE="bigintensive/frontend-dashboard:local"
LOCAL_IMAGES_LABEL="bigintensive.io/local-images=true"

if [[ ! -f "$MANIFEST_PATH" ]]; then
  echo "Manifest non trovato: $MANIFEST_PATH"
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

CURRENT_NODE_NAME="$(hostname)"

if ! sudo k3s kubectl get node "$CURRENT_NODE_NAME" >/dev/null 2>&1; then
  echo "Nodo k3s corrente non trovato: $CURRENT_NODE_NAME"
  echo "Verifica che la VM server sia registrata nel cluster con lo stesso hostname."
  exit 1
fi

echo "Etichetto il nodo $CURRENT_NODE_NAME come host per immagini locali..."
sudo k3s kubectl label node "$CURRENT_NODE_NAME" "$LOCAL_IMAGES_LABEL" --overwrite

echo "Verifica nodo k3s..."
sudo k3s kubectl get nodes

echo "Applico manifest Kubernetes..."
sudo k3s kubectl apply -f "$MANIFEST_PATH"

echo "Build immagine backend..."
sudo docker build -f backend-api/Dockerfile -t "$BACKEND_IMAGE" .

echo "Build immagine frontend..."
sudo docker build -f frontend-dashboard/Dockerfile -t "$FRONTEND_IMAGE" .

echo "Import immagini in containerd di k3s..."
sudo docker save "$BACKEND_IMAGE" | sudo k3s ctr -n k8s.io images import -
sudo docker save "$FRONTEND_IMAGE" | sudo k3s ctr -n k8s.io images import -

echo "Verifica immagini importate (namespace k8s.io)..."
sudo k3s ctr -n k8s.io images ls | grep -E 'bigintensive/(backend-api|frontend-dashboard).*local' || {
  echo "Immagini non trovate nel namespace containerd k8s.io."
  exit 1
}

echo "Riavvio deployment applicativi..."
sudo k3s kubectl rollout restart deployment/backend-api -n "$NAMESPACE"
sudo k3s kubectl rollout restart deployment/frontend-dashboard -n "$NAMESPACE"

echo "Stato pod nel namespace $NAMESPACE:"
sudo k3s kubectl get pods -n "$NAMESPACE"

echo "Fatto."
