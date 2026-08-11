import os

CITUS_URL = os.getenv("CITUS_JDBC_URL", "jdbc:postgresql://citus-coordinator:5432/bigintensive")
CITUS_PROPS = {
    "user": os.getenv("CITUS_USER", "postgres"),
    "password": os.getenv("CITUS_PASSWORD", "postgres"),
    "driver": "org.postgresql.Driver",
}

CLICKHOUSE_URL = os.getenv("CLICKHOUSE_JDBC_URL", "jdbc:clickhouse://clickhouse:8123/bigintensive")
CLICKHOUSE_PROPS = {
    "user": os.getenv("CLICKHOUSE_USER", "default"),
    "password": os.getenv("CLICKHOUSE_PASSWORD", ""),
    "driver": "com.clickhouse.jdbc.ClickHouseDriver",
}

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:19092")
KAFKA_TOPIC = os.getenv("KAFKA_TOPIC", "heart-rate-events")
KAFKA_STARTING_OFFSETS = os.getenv("SPARK_STREAM_STARTING_OFFSETS", "latest")
