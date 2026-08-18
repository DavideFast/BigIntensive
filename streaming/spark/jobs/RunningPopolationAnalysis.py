import os
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, avg, count, stddev, percentile_approx
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, DoubleType
from config import CLICKHOUSE_URL, CLICKHOUSE_PROPS, CLICKHOUSE_TABLE, POSTGRES_URL, POSTGRES_PROPS, POSTGRES_TABLE

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

payload_schema = StructType(
    [
        StructField("athlete_id", StringType(), True),
        StructField("peso", IntegerType(), True),
        StructField("altezza", DoubleType(), True),
    ]
)

df = spark.read.format("jdbc").option("url", CLICKHOUSE_URL).option("dbtable", CLICKHOUSE_TABLE).option("user", CLICKHOUSE_PROPS["user"]).option("password", CLICKHOUSE_PROPS["password"]).load()

df_postgres = spark.read.format("jdbc").option("url", POSTGRES_URL).option("dbtable", POSTGRES_TABLE).option("user", POSTGRES_PROPS["user"]).option("password", POSTGRES_PROPS["password"]).load()

df.show(5)
df_postgres.show(5)

df_ordinato = df.orderBy(col("athlete_id")).orderBy(col("session_id")).orderBy(col("sample_index"))

df_ordinato.show(5)

df_pulito = df_ordinato.dropDuplicates(["athlete_id", "session_id", "sample_index"])

df_pulito.show(5)

df_pulito_null = df_pulito.filter(
    col("athlete_id").isNotNull(),
    col("session_id").isNotNull(),
    col("sample_index").isNotNull(),
    col("heart_rate_bpm").isNotNull(),
    col("latitude").isNotNull(),
    col("longitude").isNotNull())

df_pulito_null.show(5)

df_merged = df_pulito_null.join(df_postgres, on="athlete_id", how="inner")

# Calcolo i volumi nei vari anni
df_volume = df_merged.groupBy("athlete_id", "session_id").agg(count("sample_index").alias("volume"))