from pyspark.sql import SparkSession
from pyspark.sql.functions import col, from_json, max, avg, datediff, current, StructType, StructField, StringType, DateType, DoubleType
from pyspark.sql.types import StructType, StructField, StringType, DateType, DoubleType
from datetime import datetime
from pyspark.sql.window import Window
from pyspark.sql.functions import lag, when

spark = SparkSession.builder.appName("matrice-correlazione-job").config("spark.jar.packages", "org.postgresql:postgresql:42.7.2").getOrCreate()


#Prendo tutti gli id degli esercizi da citus e creo uno schema dinamico per il json
citus_url = "jdbc:postgresql://localhost:5432/bigintensive"
citus_properties = {"user": "postgres", "password": "postgres", "driver": "org.postgresql.Driver"}
citus_tabella = spark.read.jdbc(url=citus_url, table = "esercizi", properties=citus_properties)
citus_atleta = spark.read.jdbc(url=citus_url, table = "jobs-in-coda",properties=citus_properties).select("atleta").distinct()
input_atleta = [r.atleta for r in citus_atleta.select("atleta").distinct().collect()]

campi = []
for field in citus_tabella.schema.fields:
        campi.append(StructField(field.id_esercizio, StringType(),True))
schema_json = StructType(campi)

#Prendo da clickhouse tutti i dati degli esercizi e li trasformo in un dataframe spark a parità di atleta
clickhouse_url = "jdbc:clickhouse://localhost:8123/bigintensive"
clickhouse_properties = {"user": "default", "password": "", "driver": "ru.yandex.clickhouse.ClickHouseDriver"}
clickhouse_tabella = spark.read.jdbc(url=clickhouse_url, table = "allenamenti", properties=clickhouse_properties)

campi_clickhouse = StructType([
        StructField("atleta", StringType(), True),
        StructField("giorno", DateType(), True),
        StructField("esercizio", StringType(), True),
        StructField("valore", DoubleType(), True),
        StructField("tipo", StringType(), True)
])


df_clickhouse = clickhouse_tabella.select(from_json(col("dati").cast("string"), campi_clickhouse).alias("data")).select("data.*").filter(col("atleta").isin(input_atleta))

df_primo_round = df_clickhouse.groupBy("atleta","giorno","esercizio").agg(
    max("valore").alias("max_valore"),
    avg("valore").alias("media_valore"),
    col("tipo"),
    col("giorno").cast("string").substr(0,7).alias("mese")
)

df_secondo_round = df_primo_round.groupBy("atleta","mese","esercizio").agg(
    avg("max_valore").alias("media_max_valore"),
    col("tipo"))

w = Window.partitionBy("atleta", "esercizio").orderBy("mese")

df_variazione = (
    df_secondo_round
    .withColumn("media_mensile_precedente", lag("media_max_valore", 1).over(w))
    .withColumn(
        "variazione_percentuale",
        when(
            col("media_mensile_precedente").isNull() | (col("media_mensile_precedente") == 0),
            None,
        ).otherwise(
            when(col("tipo") == "aerobico", -1).otherwise(1)
            * (
                (col("media_max_valore") - col("media_mensile_precedente"))
                / col("media_mensile_precedente")
            )
            * 100
        ),
    )
    .orderBy("atleta", "mese", "esercizio")
)

