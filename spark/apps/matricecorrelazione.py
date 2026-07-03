from pyspark.sql import SparkSession
from pyspark.sql.functions import col, from_json, max, avg, datediff, current
from pyspark.ml.feature import VectorAssembler
from pyspark.ml.stat import Correlation

spark = sparkSession.builder.appName("matrice-correlazione-job").config("spark.jar.packages", "org.apache.spark:spark-sql_2.12:5.3.0").getOrCreate()

df_kafka = spark.readStream.format("kafka").option("kafka.bootstrap.servers", "localhost:9092").option("subscribe","matrice-correlazione").option("startingOffsets","latest").load()

schema_json = StructType([
    StructField("atleta", StringType(), True),
    StructField("giorno", DateType(), True),
    StructField("frequenza cardiaca", DoubleType(), True),
    StructField("velocità", DoubleType(), True),
    StructField("distanza", DoubleType(), True),
    StructField("durata", DoubleType(), True),
    StructField("temperatura", DoubleType(), True)
])