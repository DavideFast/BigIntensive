#!/bin/bash
# Build e push del Kafka Consumer realtime

set -e

echo "=== Building Kafka Consumer Real-Time ==="
cd "$(dirname "$0")/kafka-consumer-real-time"

echo "📦 Cleaning and building with Maven..."
mvn clean package -DskipTests -q

echo "✅ Build completed successfully!"
echo "📂 JAR location: target/kafka-consumer-real-time-1.0-SNAPSHOT-jar-with-dependencies.jar"

# Opzionale: Build Docker image
if [ "$1" = "--docker" ]; then
    echo ""
    echo "🐳 Building Docker image..."
    cd ..
    docker build -t kafka-consumer-realtime:latest .
    echo "✅ Docker image built successfully!"
    
    # Opzionale: Push to registry
    if [ "$2" = "--push" ]; then
        REGISTRY=${3:-davidefast}
        echo "📤 Pushing to registry: $REGISTRY"
        docker tag kafka-consumer-realtime:latest $REGISTRY/kafka-consumer-realtime:latest
        docker push $REGISTRY/kafka-consumer-realtime:latest
        echo "✅ Image pushed successfully!"
    fi
fi

echo ""
echo "Next steps:"
echo "1. Docker Compose: docker-compose -f dev/docker-compose.yml up -d kafka-consumer"
echo "2. K3s: kubectl apply -f k3s/09-kafka-consumer.yaml"
