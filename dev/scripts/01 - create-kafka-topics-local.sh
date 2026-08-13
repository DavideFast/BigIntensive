#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: create-kafka-topics-local.sh [--compose-file path] [--bootstrap-server host:port]

Creates the Kafka topics defined in streaming/kafka/topics.json for the local Docker Compose environment.

Examples:
  bash ./dev/scripts/create-kafka-topics-local.sh
  bash ./dev/scripts/create-kafka-topics-local.sh --compose-file ./dev/docker-compose.yml
  bash ./dev/scripts/create-kafka-topics-local.sh --bootstrap-server kafka:19092
EOF
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/dev/docker-compose.yml}"
TOPICS_FILE="${TOPICS_FILE:-$REPO_ROOT/streaming/kafka/topics.json}"
BOOTSTRAP_SERVER="${BOOTSTRAP_SERVER:-kafka:19092}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --compose-file)
      COMPOSE_FILE="$2"
      shift 2
      ;;
    --bootstrap-server)
      BOOTSTRAP_SERVER="$2"
      shift 2
      ;;
    --topic-file)
      TOPICS_FILE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$TOPICS_FILE" ]]; then
  echo "Topic catalog not found: $TOPICS_FILE" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

python3 - "$TOPICS_FILE" "$BOOTSTRAP_SERVER" <<'PY'
import json
import subprocess
import sys
from pathlib import Path

config_path = Path(sys.argv[1])
bootstrap_server = sys.argv[2]

with config_path.open("r", encoding="utf-8") as fh:
    config = json.load(fh)

for topic in config.get("topics", []):
    name = topic["name"]
    partitions = topic.get("partitions", config.get("defaultPartitions", 3))
    replication_factor = topic.get("replicationFactor", config.get("defaultReplicationFactor", 1))
    command = [
        "docker", "compose",
        "-f", "dev/docker-compose.yml",
        "exec",
        "-T",
        "kafka",
        "/opt/bitnami/kafka/bin/kafka-topics.sh",
        "--bootstrap-server",
        bootstrap_server,
        "--create",
        "--if-not-exists",
        "--topic",
        name,
        "--partitions",
        str(partitions),
        "--replication-factor",
        str(replication_factor),
    ]
    for key, value in topic.get("config", {}).items():
        command.extend(["--config", f"{key}={value}"])

    print(f"Creating topic: {name}")
    subprocess.run(command, check=True)
PY

echo "All local Kafka topics created successfully for bootstrap server: $BOOTSTRAP_SERVER"
