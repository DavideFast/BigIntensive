from pyspark.sql import SparkSession
from pyspark.sql.functions import col, from_json, max, avg, datediff, current, StructType, StructField, StringType, DateType, DoubleType

spark = SparkSession.builder.appName("matrice-correlazione-job").config("spark.jar.packages", "org.postgresql:postgresql:42.7.2").getOrCreate()


#Prendo tutti gli id degli esercizi da citus e creo uno schema dinamico per il json
citus_url = "jdbc:postgresql://localhost:5432/bigintensive"
citus_properties = {"user": "postgres", "password": "postgres", "driver": "org.postgresql.Driver"}
citus_tabella = spark.read.jdbc(url=citus_url, table = "esercizi", properties=citus_properties)

campi = []
for field in citus_tabella.schema.fields:
        campi.append(StructField(field.id, StringType(),True))

schema_json = StructType(campi)