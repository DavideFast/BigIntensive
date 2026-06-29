import os
from typing import List


def kafka_bootstrap_servers() -> List[str]:
    """Return bootstrap servers list from env or sensible default for host usage."""
    raw_value = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9094")
    return [item.strip() for item in raw_value.split(",") if item.strip()]


def kafka_default_topic() -> str:
    return os.getenv("KAFKA_TOPIC", "demo-events")
