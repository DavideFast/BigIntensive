from pyspark.sql import SparkSession
from pyspark.sql.functions import col, max, avg, datediff, current_date, lit

spark = SparkSession.builder.appName("training-status-job").config("spark.jars.packages", "com.clickhouse:clickhouse-jdbc:0.6.3").getOrCreate()

clickhouse_url = "jdbc:clickhouse://localhost:8123/bigintensive"
clickhouse_properties = {
    "user": "default",
    "password": "",
    "driver": "com.clickhouse.jdbc.ClickHouseDriver",
}

df_clickhouse = spark.read.jdbc(
    url=clickhouse_url,
    table="bigintensive.corsa_endurance_campioni",
    properties=clickhouse_properties,
)

df_tabella = df_clickhouse.select(
    col("atleta_id").cast("string").alias("atleta"),
    col("ts").cast("date").alias("giorno"),
    col("heart_rate_bpm").cast("double").alias("frequenza cardiaca"),
    (col("speed_kmh").cast("double") / lit(3.6)).alias("velocità"),
    (col("secondo").cast("double") * (col("speed_kmh").cast("double") / lit(3.6))).alias("distanza"),
    col("secondo").cast("double").alias("durata"),
    lit(20.0).alias("temperatura"),
)



df_raggruppato = df_tabella.groupBy("atleta","giorno").agg(
    max("durata").alias("max_durata"), # in secondi
    avg("velocità").alias("media_velocita"), # in m/s
    avg("frequenza cardiaca").alias("media_freq_cardiaca"), #in bpm
    max("distanza").alias("max_distanza"), # in metri
    avg("temperatura").alias("temperatura") #in gradi Celsius
)

def process_batch(batch_df, batch_id):
    df_risultato = batch_df.withColumn(
        "indice_allenamento",
        col("media_freq_cardiaca") / col("max_durata") / col("media_velocita") / col("temperatura")
    )
    df_risultato.cache()

    # Output 1: indice di allenamento per atleta e giorno
    print(f"=== Batch {batch_id} — Indice per atleta/giorno ===")
    df_risultato.show(truncate=False)

    # Output 2: media indice ultimi 42 giorni con durata > 500s
    df_secondo_round = df_risultato.filter(
        (col("max_distanza") > 500) & (datediff(current_date(), col("giorno")) <= 42)
    ).groupBy("atleta").agg(avg("indice_allenamento").alias("indice_allenamento_max"))

    print(f"=== Batch {batch_id} — Media indice ultimi 42 giorni ===")
    df_secondo_round.show(truncate=False)

    # Output 3: indice del giorno corrente per ogni atleta
    df_secondo_round_parallelo = df_risultato.filter(
        (col("max_distanza") > 500) 
    ).select("atleta", "indice_allenamento","giorno")

    print(f"=== Batch {batch_id} — Indici per giorno ===")
    df_secondo_round_parallelo.show(truncate=False)

    df_risultato.unpersist()


process_batch(df_raggruppato, 0)
