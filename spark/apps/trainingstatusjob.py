from pyspark.sql import SparkSession
from pyspark.sql.functions import  col
from pyspark.sql.types import StructType, StructField, StringType, DateType
from pyspark.sql.functions import from_json, max, avg

spark = SparkSession.builder.appName("training-status-job").config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0").getOrCreate()

df_kafka = spark.readStream.format("kafka").option("kafka.bootstrap.servers", "localhost:9092").option("subscribe", "training-status").option("startingOffsets", "latest").load()

schema_json = StructType ([
    StructField("Atleta", StringType(), True),
    StructField("Data", DateType(), True),
    StructField("Frequenza cardiaca", StringType(), True),
    StructField("Velocità", StringType(), True),
    StructField("Distanza", StringType(), True),
    StructField("Durata", StringType(), True),
    StructField("Temperatura", StringType(), True)
])
df_kafka_schema = df_kafka.select(from_json(col("value").cast("string"), schema_json).alias("data")).select("data.*")



df_raggruppato = df_kafka_schema.groupBy("id","giorno").agg(max("durata"),avg("velocità"),avg("frequenza cardiaca"),max("distanza"),avg("temperatura"),max("giorno"))

df_risultato = df_raggruppato.withColumn(
    "indice_allenamento",
    col("media_freq_cardiaca") / col("max_durata") / col("media_velocita") / col("temperatura")  # <-- la tua formula
)
df_secondo_round = df_risultato.groupBy("id").filter(col("durata")>500 & max(giorno) - col("giorno")<=42).agg(avg("indice_allenamento").alias("indice_allenamento_max"))

query = df_risultato.writeStream \
    .outputMode("complete") \
    .format("console") \
    .start()

query.awaitTermination()
