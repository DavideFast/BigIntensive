from curses import window
from math import radians, sin, cos, sqrt, atan2
import os
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, avg, count, lag
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, DoubleType
from pyspark.sql.window import Window
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

df_postgres_aggiustato = df_postgres.withColumn("BMI", col("peso_kg") / (col("altezza_m") * col("altezza_m")))

finestra_temporale = Window.partitionBy("athlete_id", "session_id").orderBy("sample_index")
finestra_temporale_5s = finestra_temporale.rowsBetween(-1, 0)
finestra_temporale_5min = finestra_temporale.rowsBetween(-60, 0)

df_ordinato = df.orderBy(col("athlete_id"), col("session_id"), col("sample_index"))
df_ordinato.show(5)

df_pulito = df_ordinato.dropDuplicates(["athlete_id", "session_id", "sample_index"])

df_pulito.show(5)

df_pulito_null = df_pulito.filter(
    col("athlete_id").isNotNull(),
    col("session_id").isNotNull(),
    col("sample_index").isNotNull(),
    col("heart_rate_bpm").isNotNull(),
    col("latitude").isNotNull(),
    col("longitude").isNotNull(),
    col("timestamp").isNotNull())

df_pulito_null.show(5)




df_merged = df_pulito_null.join(df_postgres_aggiustato, (df_pulito_null["athlete_id"] == df_postgres_aggiustato["athlete_id"]) & (df_pulito_null["timestamp"] == df_postgres_aggiustato["data_rilevazione"]), how="inner")

# Calcolo i volumi nei vari anni
df_volume = df_merged.groupBy("athlete_id", "session_id").agg(count("sample_index").alias("volume"))

# Calcolo deriva cardiaca puntuale per valore antropometrico

R=6371000  # Raggio della Terra in metri
df_deriva_cardiaca = df_merged \
    .withColumn("lat_prec", lag("latitude", 1).over(finestra_temporale)) \
    .withColumn("lon_prec", lag("longitude", 1).over(finestra_temporale)) \
    .withColumn("lat_rad", radians(col("latitude"))) \
    .withColumn("lon_rad", radians(col("longitude"))) \
    .withColumn("lat_prec_rad", radians(col("lat_prec"))) \
    .withColumn("lon_prec_rad", radians(col("lon_prec"))) \
    .withColumn("dlat", col("lat_rad") - col("lat_prec_rad")) \
    .withColumn("dlon", col("lon_rad") - col("lon_prec_rad")) \
    .withColumn("a", sin(col("dlat") / 2) ** 2 + cos(col("lat_rad")) * cos(col("lat_prec_rad")) * sin(col("dlon") / 2) ** 2) \
    .withColumn("c", 2 * atan2(sqrt(col("a")), sqrt(1 - col("a")))) \
    .withColumn("distanza", R * col("c")) \
    .withColumn("velocita_puntuale", col("distanza") / 5) \
    .withColumn("velocita_media_media", avg("velocita_puntuale").over(finestra_temporale_5min)) \
    .withColumn("frequenza_cardiaca_media", avg("heart_rate_bpm").over(finestra_temporale_5min)) \
    .withColumn("Efficienza_puntuale", col("velocita_puntuale") / col("frequenza_cardiaca_media")) \
    .withColumn("Efficienza_puntuale_iniziale", first("Efficienza_puntuale").over(finestra_temporale)) \

df_deriva_cardiaca = df_deriva_cardiaca.withColumn("Deriva_cardiaca_percentuale", (col("Efficienza_puntuale")- col("Efficienza_puntuale_iniziale")) / col("Efficienza_puntuale_iniziale") * 100)

print("Deriva cardiaca calcolata con successo.")
df_deriva_cardiaca.filter("second(timestamp) % 5 = 0 and minute(timestamp) % 15 = 0") \
    .select("timestamp", "athlete_id", "session_id", "heart_rate_bpm", "cadence_spm", "speed_kmh", "altitude_m", "temperature_c",  "peso_kg", "altezza_m", "BMI", "velocita_puntuale", "velocita_media_media", "frequenza_cardiaca_media", "Efficienza_puntuale", "Deriva_cardiaca_percentuale") \
    .show(truncate=False)