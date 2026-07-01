#!/bin/bash

# BigIntensive k3s Deployment Script
# Applies all YAML manifests in the correct order

set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KUBECTL_CMD="${KUBECTL_CMD:-sudo k3s kubectl}"

echo "🚀 BigIntensive k3s Deployment"
echo "========================================"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to apply a manifest with progress indication
apply_manifest() {
    local file="$1"
    local description="$2"
    
    if [ ! -f "$file" ]; then
        echo "❌ File not found: $file"
        exit 1
    fi
    
    echo -e "${BLUE}Applying: $description${NC}"
    $KUBECTL_CMD apply -f "$file"
    echo -e "${GREEN}✓ $description${NC}\n"
}

# Apply in order
apply_manifest "$SCRIPT_DIR/00-namespace-and-secrets.yaml" "Namespace, Secrets & ConfigMaps"
apply_manifest "$SCRIPT_DIR/01-citus.yaml" "Citus PostgreSQL Cluster"
apply_manifest "$SCRIPT_DIR/02-kafka.yaml" "Kafka & Kafka UI"
apply_manifest "$SCRIPT_DIR/03-backend-api.yaml" "Backend API"
apply_manifest "$SCRIPT_DIR/04-frontend-dashboard.yaml" "Frontend Dashboard"
apply_manifest "$SCRIPT_DIR/05-spark-and-jupyter.yaml" "Spark & Jupyter"
apply_manifest "$SCRIPT_DIR/06-ingress.yaml" "Ingress Routes"

echo -e "${GREEN}========================================"
echo "✓ All resources deployed successfully!"
echo "========================================${NC}"

echo ""
echo "📋 Useful commands:"
echo "   Check all pods:     $KUBECTL_CMD get pods -n bigintensive"
echo "   Watch pods:         $KUBECTL_CMD get pods -n bigintensive -w"
echo "   Describe pod:       $KUBECTL_CMD describe pod <pod-name> -n bigintensive"
echo "   View logs:          $KUBECTL_CMD logs <pod-name> -n bigintensive"
echo ""
echo "🌐 Access URLs (add to /etc/hosts if needed):"
echo "   Frontend:  http://bigintensive.local or http://192.168.x.x"
echo "   Backend:   http://api.bigintensive.local"
echo "   Kafka UI:  http://kafka-ui.bigintensive.local"
echo "   Jupyter:   http://jupyter.bigintensive.local (token: changeme)"
