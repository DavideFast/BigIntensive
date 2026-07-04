from pyspark.sql import SparkSession
from pyspark.sql.functions import col, from_json, max, avg, datediff, current
from pyspark.sql.types import StructType, StructField, StringType, DateType, DoubleType
from pyspark.ml.feature import VectorAssembler
from pyspark.ml.stat import Correlation
from datetime import datetime
from pyspark.sql.window import Window
from pyspark.sql.functions import lag, when

spark = SparkSession.builder.appName("matrice-correlazione-job").config("spark.jar.packages", "org.postgresql:postgresql:42.7.2", "com.clickhouse:clickhouse-jdbc:0.9.8-all").getOrCreate()


#Prendo tutti gli id degli esercizi da citus e creo uno schema dinamico per il json
citus_url = "jdbc:postgresql://localhost:5432/bigintensive"
citus_properties = {"user": "postgres", "password": "postgres", "driver": "org.postgresql.Driver"}
citus_esercizi = spark.read.jdbc(url=citus_url, table = "exercises", properties=citus_properties)
citus_atleta = spark.read.jdbc(url=citus_url, table = "jobs_in_coda",properties=citus_properties).select("athlete_id").distinct()
input_atleta = [str(r.athlete_id) for r in citus_atleta.select("athlete_id").distinct().collect()]

campi = []
for field in citus_esercizi.schema.fields:
        campi.append(StructField(field.name, StringType(),True))
schema_json = StructType(campi)

#Prendo da clickhouse tutti i dati degli esercizi e li trasformo in un dataframe spark a parità di atleta
clickhouse_url = "jdbc:clickhouse://localhost:8123/bigintensive"
clickhouse_properties = {"user": "default", "password": "", "driver": "ru.yandex.clickhouse.ClickHouseDriver"}
clickhouse_tabella = spark.read.jdbc(url=clickhouse_url, table = "allenamento_dettagli", properties=clickhouse_properties)


df_clickhouse = clickhouse_tabella.selectExpr(
    "CAST(atleta_id AS STRING) AS atleta",
    "CAST(ts AS DATE) AS giorno",
    "CAST(esercizio_id AS STRING) AS esercizio",
    "CAST(risultato AS DOUBLE) AS valore",
    "'forza' AS tipo"
).filter(col("atleta").isin(input_atleta))

df_primo_round = (
    df_clickhouse
    .withColumn("mese", col("giorno").cast("string").substr(1,7))
    .groupBy("atleta","giorno","esercizio","mese","tipo")
    .agg(
        max("valore").alias("max_valore"),
        avg("valore").alias("media_valore"),
    )
)

df_secondo_round = df_primo_round.groupBy("atleta","mese","esercizio","tipo").agg(
    avg("max_valore").alias("media_max_valore")
)


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

# Creare matrici di correlazione separate per atleta con MLlib
pivot_df = (
    df_variazione
    .groupBy("atleta", "mese")
    .pivot("esercizio")
    .agg(avg("variazione_percentuale"))
    .fillna(0)
)

feature_columns = [c for c in pivot_df.columns if c not in ["atleta", "mese"]]
matrici_per_atleta = {}

if len(feature_columns) < 2:
    print("Dati insufficienti: servono almeno 2 esercizi per calcolare la correlazione")
else:
    assembler = VectorAssembler(inputCols=feature_columns, outputCol="features")
    athlete_ids = [r["atleta"] for r in pivot_df.select("atleta").distinct().collect()]

    for atleta_id in athlete_ids:
        athlete_df = pivot_df.filter(col("atleta") == atleta_id)
        sample_count = athlete_df.count()

        if sample_count < 2:
            print(f"Atleta {atleta_id}: dati insufficienti per la correlazione (righe={sample_count})")
            continue

        df_features = assembler.transform(athlete_df).select("features")
        correlation_matrix = Correlation.corr(df_features, "features", "pearson").head()[0]

        matrici_per_atleta[atleta_id] = {
            "columns": feature_columns,
            "matrix": correlation_matrix.toArray().tolist(),
            "rows": sample_count,
        }

        print(f"=== Matrice di correlazione (Pearson) atleta {atleta_id} ===")
        print("Colonne:", feature_columns)
        print(correlation_matrix)

