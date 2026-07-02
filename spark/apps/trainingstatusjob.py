from pyspark.sql import SparkSession
from pyspark.sql.functions import  col
from pyspark.sql.types import StructType, StructField, StringType, DateType
from pyspark.sql.functions import from_json, max, avg, datediff, current_date

spark = SparkSession.builder.appName("training-status-job").config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0").getOrCreate()

df_kafka = spark.readStream.format("kafka").option("kafka.bootstrap.servers", "localhost:9092").option("subscribe", "training-status").option("startingOffsets", "latest").load()

schema_json = StructType ([
    StructField("Atleta", StringType(), True),
    StructField("Giorno", DateType(), True),
    StructField("Frequenza cardiaca", StringType(), True),
    StructField("Velocità", StringType(), True),
    StructField("Distanza", StringType(), True),
    StructField("Durata", StringType(), True),
    StructField("Temperatura", StringType(), True)
])
df_kafka_schema = df_kafka.select(from_json(col("value").cast("string"), schema_json).alias("data")).select("data.*")



df_raggruppato = df_kafka_schema.groupBy("atleta","giorno").agg(
    max("durata").alias("max_durata"),
    avg("velocità").alias("media_velocita"),
    avg("frequenza cardiaca").alias("media_freq_cardiaca"),
    max("distanza").alias("max_distanza"),
    avg("temperatura").alias("temperatura")
)

df_risultato = df_raggruppato.withColumn(
    "indice_allenamento",
    col("media_freq_cardiaca") / col("max_durata") / col("media_velocita") / col("temperatura")  # <-- la tua formula
)
df_secondo_round = df_risultato.filter(
    (col("max_durata") > 500) & (datediff(current_date(), col("giorno")) <= 42)
).groupBy("atleta").agg(avg("indice_allenamento").alias("indice_allenamento_max"))

query = df_secondo_round.writeStream \
    .outputMode("complete") \
    .format("console") \
    .start()

query.awaitTermination()
