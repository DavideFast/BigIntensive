from pyspark.sql import SparkSession
from pyspark.sql.functions import explode, split, lower, col

spark = SparkSession.builder.appName("wordcount-example").getOrCreate()

input_path = "/opt/spark-data/input.txt"

df = spark.read.text(input_path)

word_counts = (
    df.select(explode(split(lower(col("value")), r"\\s+")).alias("word"))
      .where(col("word") != "")
      .groupBy("word")
      .count()
      .orderBy(col("count").desc(), col("word").asc())
)

word_counts.show(20, truncate=False)

spark.stop()
