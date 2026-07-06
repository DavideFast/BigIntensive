import os

from pyspark.sql import SparkSession
from pyspark.sql.functions import coalesce, col, from_json, regexp_extract, to_timestamp, unix_timestamp
from pyspark.sql.types import DoubleType, IntegerType, StringType, StructField, StructType


KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
KAFKA_TOPIC = os.getenv("KAFKA_TOPIC", "heart-rate-events")
KAFKA_STARTING_OFFSETS = os.getenv("SPARK_STREAM_STARTING_OFFSETS", "latest")

CLICKHOUSE_URL = os.getenv("CLICKHOUSE_JDBC_URL", "jdbc:clickhouse://localhost:8123/bigintensive")
CLICKHOUSE_TABLE = os.getenv("CLICKHOUSE_TABLE", "bigintensive.corsa_endurance_campioni")
CLICKHOUSE_USER = os.getenv("CLICKHOUSE_USER", "default")
CLICKHOUSE_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "")

CHECKPOINT_DIR = os.getenv(
    "SPARK_CHECKPOINT_DIR",
    "./spark-checkpoints/smartwatch-to-clickhouse",
)

spark = (
    SparkSession.builder.appName("smartwatch-to-clickhouse-consumer")
    .config(
        "spark.jars.packages",
        "org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0,com.clickhouse:clickhouse-jdbc:0.6.3",
    )
    .getOrCreate()
)

spark.sparkContext.setLogLevel("WARN")

payload_schema = StructType(
    [
        StructField("athlete_id", StringType(), True),
        StructField("session_id", IntegerType(), True),
        StructField("heart_rate_bpm", DoubleType(), True),
        StructField("cadence_spm", DoubleType(), True),
        StructField("speed_kmh", DoubleType(), True),
        StructField("altitude_m", DoubleType(), True),
        StructField("temperature_c", DoubleType(), True),
        StructField("timestamp", StringType(), True),
        StructField("sample_index", IntegerType(), True),
    ]
)

kafka_df = (
    spark.readStream.format("kafka")
    .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP_SERVERS)
    .option("subscribe", KAFKA_TOPIC)
    .option("startingOffsets", KAFKA_STARTING_OFFSETS)
    .load()
)

parsed_df = (
    kafka_df.select(from_json(col("value").cast("string"), payload_schema).alias("data"))
    .select("data.*")
    .withColumn("ts", to_timestamp(col("timestamp")))
    .withColumn("atleta_id", regexp_extract(col("athlete_id"), r"(\\d+)$", 1).cast("int"))
    .withColumn(
        "sessione_id",
        coalesce(col("session_id").cast("int"), unix_timestamp(col("ts")).cast("int")),
    )
    .withColumn("secondo", col("sample_index").cast("int"))
    .select(
        col("atleta_id").cast("int"),
        col("sessione_id").cast("int"),
        col("secondo").cast("int"),
        col("heart_rate_bpm").cast("double"),
        col("cadence_spm").cast("double"),
        col("speed_kmh").cast("double"),
        col("altitude_m").cast("double"),
        col("temperature_c").cast("double"),
        col("ts"),
    )
    .filter(col("atleta_id").isNotNull() & col("ts").isNotNull())
)


def write_batch_to_clickhouse(batch_df, batch_id):
    if batch_df.rdd.isEmpty():
        return

    output_df = batch_df.select(
        col("atleta_id").alias("atleta_id"),
        col("sessione_id").alias("sessione_id"),
        col("secondo").alias("secondo"),
        col("heart_rate_bpm").cast("float").alias("heart_rate_bpm"),
        col("cadence_spm").cast("float").alias("cadence_spm"),
        col("speed_kmh").cast("float").alias("speed_kmh"),
        col("altitude_m").cast("float").alias("altitude_m"),
        col("temperature_c").cast("float").alias("temperature_c"),
        col("ts").alias("ts"),
    )

    (
        output_df.write.mode("append")
        .format("jdbc")
        .option("url", CLICKHOUSE_URL)
        .option("dbtable", CLICKHOUSE_TABLE)
        .option("user", CLICKHOUSE_USER)
        .option("password", CLICKHOUSE_PASSWORD)
        .option("driver", "com.clickhouse.jdbc.ClickHouseDriver")
        .save()
    )

    print(f"Batch {batch_id}: scritti campioni smartwatch in ClickHouse")


query = (
    parsed_df.writeStream.outputMode("append")
    .option("checkpointLocation", CHECKPOINT_DIR)
    .foreachBatch(write_batch_to_clickhouse)
    .start()
)

print(
    "Consumer avviato: Kafka -> ClickHouse "
    f"(topic={KAFKA_TOPIC}, table={CLICKHOUSE_TABLE}, brokers={KAFKA_BOOTSTRAP_SERVERS}, startingOffsets={KAFKA_STARTING_OFFSETS})"
)

query.awaitTermination()
