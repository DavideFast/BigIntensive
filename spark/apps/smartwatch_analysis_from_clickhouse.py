import argparse
import os

from pyspark.sql import SparkSession
from pyspark.sql.functions import avg, col, count, max, min, round, sum, when


CLICKHOUSE_URL = os.getenv("CLICKHOUSE_JDBC_URL", "jdbc:clickhouse://localhost:8123/bigintensive")
CLICKHOUSE_TABLE = os.getenv("CLICKHOUSE_TABLE", "bigintensive.corsa_endurance_campioni")
CLICKHOUSE_USER = os.getenv("CLICKHOUSE_USER", "default")
CLICKHOUSE_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "")


def build_parser():
    parser = argparse.ArgumentParser(
        description="Analisi on-demand sessioni smartwatch da ClickHouse (nessuna lettura diretta Kafka)",
    )
    parser.add_argument("--athlete-id", type=int, required=True, help="ID atleta")
    parser.add_argument("--session-id", type=int, required=True, help="ID sessione")
    return parser


def main():
    args = build_parser().parse_args()

    spark = (
        SparkSession.builder.appName("smartwatch-analysis-from-clickhouse")
        .config("spark.jars.packages", "com.clickhouse:clickhouse-jdbc:0.6.3")
        .getOrCreate()
    )

    spark.sparkContext.setLogLevel("WARN")

    clickhouse_properties = {
        "user": CLICKHOUSE_USER,
        "password": CLICKHOUSE_PASSWORD,
        "driver": "com.clickhouse.jdbc.ClickHouseDriver",
    }

    base_df = spark.read.jdbc(
        url=CLICKHOUSE_URL,
        table=CLICKHOUSE_TABLE,
        properties=clickhouse_properties,
    )

    session_df = base_df.filter(
        (col("atleta_id") == args.athlete_id) & (col("sessione_id") == args.session_id)
    )

    if session_df.rdd.isEmpty():
        print(
            f"Nessun campione trovato per atleta_id={args.athlete_id}, sessione_id={args.session_id}."
        )
        spark.stop()
        return

    # KPI sessione per analisi finale a sessione chiusa.
    summary_df = session_df.groupBy("atleta_id", "sessione_id").agg(
        count("*").alias("samples"),
        min("ts").alias("start_ts"),
        max("ts").alias("end_ts"),
        min("secondo").alias("sec_min"),
        max("secondo").alias("sec_max"),
        round(avg("heart_rate_bpm"), 2).alias("avg_hr_bpm"),
        min("heart_rate_bpm").alias("min_hr_bpm"),
        max("heart_rate_bpm").alias("max_hr_bpm"),
        round(avg("cadence_spm"), 2).alias("avg_cadence_spm"),
        round(avg("speed_kmh"), 2).alias("avg_speed_kmh"),
        round((max("altitude_m") - min("altitude_m")), 2).alias("elevation_range_m"),
        sum(when(col("heart_rate_bpm") < 120, 1).otherwise(0)).alias("z1_samples"),
        sum(
            when((col("heart_rate_bpm") >= 120) & (col("heart_rate_bpm") < 140), 1).otherwise(0)
        ).alias("z2_samples"),
        sum(
            when((col("heart_rate_bpm") >= 140) & (col("heart_rate_bpm") < 160), 1).otherwise(0)
        ).alias("z3_samples"),
        sum(
            when((col("heart_rate_bpm") >= 160) & (col("heart_rate_bpm") < 175), 1).otherwise(0)
        ).alias("z4_samples"),
        sum(when(col("heart_rate_bpm") >= 175, 1).otherwise(0)).alias("z5_samples"),
    ).withColumn("duration_seconds", col("sec_max") - col("sec_min"))

    print(
        f"=== Analisi sessione completata (atleta_id={args.athlete_id}, sessione_id={args.session_id}) ==="
    )
    summary_df.show(truncate=False)

    spark.stop()


if __name__ == "__main__":
    main()
