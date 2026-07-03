from pyspark.sql import SparkSession
from pyspark.sql.functions import col, from_json, max, avg, datediff, current, StructType, StructField, StringType, DateType, DoubleType

spark = SparkSession.builder.appName("matrice-correlazione-job").config("spark.jar.packages", "org.postgresql:postgresql:42.7.2").getOrCreate()


#Prendo tutti gli id degli esercizi da citus e creo uno schema dinamico per il json
citus_url = "jdbc:postgresql://localhost:5432/bigintensive"
citus_properties = {"user": "postgres", "password": "postgres", "driver": "org.postgresql.Driver"}
citus_tabella = spark.read.jdbc(url=citus_url, table = "esercizi", properties=citus_properties)
citus_atleta = spark.read.jdbc(url=citus_url, table = "jobs-in-coda",properties=citus_properties).select("atleta").distinct()


campi = []
for field in citus_tabella.schema.fields:
        campi.append(StructField(field.id, StringType(),True))
schema_json = StructType(campi)

#Prendo da clickhouse tutti i dati degli esercizi e li trasformo in un dataframe spark a parità di atleta
clickhouse_url = "jdbc:clickhouse://localhost:8123/bigintensive"
clickhouse_properties = {"user": "default", "password": "", "driver": "ru.yandex.clickhouse.ClickHouseDriver"}
clickhouse_tabella = spark.read.jdbc(url=clickhouse_url, table = "allenamenti", properties=clickhouse_properties)

campi_clickhouse = StructType([
        StructField("atleta", StringType(), True),
        StructField("giorno", DateType(), True),
        StructField("esercizio", StringType(), True),
        StructField("valore", DoubleType(), True)
])


df_clickhouse = clickhouse_tabella.select(from_json(col("dati").cast("string"), campi_clickhouse).alias("data")).select("data.*").filter(col("atleta") == atleta_input)