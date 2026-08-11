$ErrorActionPreference = 'Stop'

$topic = if ($env:KAFKA_TEST_TOPIC) { $env:KAFKA_TEST_TOPIC } else { 'demo-events' }

Write-Host 'Starting Kafka services...'
docker compose up -d kafka kafka-ui

Write-Host "Creating topic: $topic"
docker compose exec -T kafka /opt/bitnami/kafka/bin/kafka-topics.sh --create --if-not-exists --topic $topic --bootstrap-server kafka:9092 --partitions 3 --replication-factor 1

Write-Host 'Producing one message...'
"hello from bigintensive" | docker compose exec -T kafka /opt/bitnami/kafka/bin/kafka-console-producer.sh --topic $topic --bootstrap-server kafka:9092

Write-Host 'Consuming one message...'
docker compose exec -T kafka /opt/bitnami/kafka/bin/kafka-console-consumer.sh --topic $topic --bootstrap-server kafka:9092 --from-beginning --max-messages 1

Write-Host 'Kafka smoke test completed.'
