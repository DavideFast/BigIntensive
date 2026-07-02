from pyspark.sql import SparkSession
from pyspark.sql.functions import explode, split, lower, col

spark = SparkSession.builder.appName("training-status-job").config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0").getOrCreate()

input_path = "/opt/spark-data/input.txt"

df = spark.read.text(input_path)

df_kafka = spark.readStream.format("kafka").option("kafka.bootstrap.servers", "localhost:9092").option("subscribe", "training-status").option("startingOffsets", "latest").load()
word_counts = (
    df.select(explode(split(lower(col("value")), r"\\s+")).alias("word"))
      .where(col("word") != "")
      .groupBy("word")
      .count()
      .orderBy(col("count").desc(), col("word").asc())
)

word_counts.show(20, truncate=False)

spark.stop()
