import os
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, avg, count, stddev, percentile_approx
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, DoubleType
from config import CLICKHOUSE_URL, CLICKHOUSE_PROPS

CLICKHOUSE_TABLE = os.getenv("CLICKHOUSE_TABLE", "bigintensive.corsa_endurance_campioni")

spark = (
    SparkSession.builder.appName("running-population-analysis")
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
        StructField("GPS", IntegerType(), True),
        StructField("sample_index", IntegerType(), True),
    ]
)

