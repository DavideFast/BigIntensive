from pyspark.sql import SparkSession
from pyspark.sql.functions import col, from_json, max, avg, datediff, current_date
from pyspark.sql.types import StructType, StructField, StringType, DateType, DoubleType

spark = SparkSession.builder.appName("training-status-job").config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0").getOrCreate()

df_kafka = spark.readStream.format("kafka").option("kafka.bootstrap.servers", "localhost:9092").option("subscribe", "training-status").option("startingOffsets", "latest").load()

schema_json = StructType ([
    StructField("atleta", StringType(), True),
    StructField("giorno", DateType(), True),
    StructField("frequenza cardiaca", DoubleType(), True),
    StructField("velocità", DoubleType(), True),
    StructField("distanza", DoubleType(), True),
    StructField("durata", DoubleType(), True),
    StructField("temperatura", DoubleType(), True)
])
df_kafka_schema = df_kafka.select(from_json(col("value").cast("string"), schema_json).alias("data")).select("data.*")



df_raggruppato = df_kafka_schema.groupBy("atleta","giorno").agg(
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


query = df_raggruppato.writeStream \
    .outputMode("update") \
    .foreachBatch(process_batch) \
    .start()

query.awaitTermination()
