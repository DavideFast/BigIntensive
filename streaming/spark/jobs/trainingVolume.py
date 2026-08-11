#!/usr/bin/env python3
"""
Job 3: Training Volume Clustering & Anomaly Detection
Aggregates exercise volumes by athlete, performs K-Means clustering,
detects anomalies, and joins with pre-computed weekly cardio metrics from Job 1.

Input:
  - ClickHouse: allenamento_dettagli (exercise sessions)
  - Citus: weekly_cardio_aggregates (pre-computed from Job 1)

Output:
  - Citus: exercise_volumes_clusters (cluster assignments, anomaly flags)
"""

from pyspark.sql import SparkSession, Window
from pyspark.sql.functions import (
    col, sum, avg, max, count, stddev, when, lag, lead, concat_ws,
    year, weekofyear
)
from pyspark.ml.feature import VectorAssembler, StandardScaler
from pyspark.ml.clustering import KMeans
import os
from datetime import datetime
from config import CITUS_URL, CITUS_PROPS, CLICKHOUSE_URL, CLICKHOUSE_PROPS

#######################################################################################################################
###                                                                                                                 ###
###                                          INITIALIZE SPARK SESSION                                               ###
###                                                                                                                 ###
#######################################################################################################################

spark = SparkSession.builder \
    .appName("job3-training-volume-clustering") \
    .config("spark.sql.shuffle.partitions", "10") \
    .getOrCreate()

#######################################################################################################################
###                                                                                                                 ###
###                                          DATABASE CONNECTIONS                                                   ###
###                                                                                                                 ###
#######################################################################################################################




def read_exercise_types():
    """Read exercise types from Citus"""
    df = spark.read.jdbc(
        url=CITUS_URL,
        table="exercises",
        properties=CITUS_PROPS,
    )
    return df.select(
        col("exercise_id"),
        col("tipo_esercizio").alias("exercise_type"),  # forza, mobilità, endurance
    )

def read_strength_mobility_volumes():
    """Read strength and mobility exercise volumes from ClickHouse"""
    df = spark.read.jdbc(
        url=CLICKHOUSE_URL,
        table="bigintensive.allenamento_dettagli",
        properties=CLICKHOUSE_PROPS,
    )
    return df.select(
        col("atleta_id").cast("integer").alias("athlete_id"),
        col("ts").cast("date").alias("training_date"),
        col("esercizio_id").cast("integer").alias("exercise_id"),
        col("serie").cast("double").alias("sets"),
        col("ripetizioni").cast("double").alias("reps"),
        col("risultato").cast("double").alias("result"),
    )

def read_weekly_cardio():
    """Read pre-aggregated weekly cardio data from Citus (output of Job 1)"""
    df = spark.read.jdbc(
        url=CITUS_URL,
        table="weekly_cardio_aggregates",
        properties=CITUS_PROPS,
    )
    return df.select(
        col("athlete_id"),
        col("week_id").alias("year_week"),
        col("total_trimp").cast("double"),
        col("total_km_running").cast("double"),
        col("avg_hr"),
        col("max_hr"),
        col("avg_hrv"),
        col("avg_speed"),
    )

#######################################################################################################################
###                                                                                                                 ###
###                                          DATA PROCESSING AND METRICS CALCULATION                                ###
###                                                                                                                 ###
#######################################################################################################################


def aggregate_exercise_volumes_by_type(df_exercises, df_exercise_types):
    """
    Aggregate exercise volumes by athlete, week, and exercise type.
    Returns: athlete_id, year_week, exercise_type, volume_metric, session_count
    """
    
    # Join exercises with their types
    df_with_types = df_exercises.join(
        df_exercise_types,
        on="exercise_id",
        how="left"
    )
    
    # Add year-week column
    df_with_week = df_with_types.withColumn(
        "year_week",
        concat_ws("-", year("training_date"), weekofyear("training_date"))
    )
    
    # Calculate volume per exercise
    df_with_volume = df_with_week.withColumn(
        "volume_metric",
        col("sets") * col("reps") * col("result")
    )
    
    # Aggregate by type per week
    weekly_by_type = df_with_volume.groupBy(
        "athlete_id",
        "year_week",
        "exercise_type"
    ).agg(
        sum("volume_metric").alias("total_volume"),
        count("*").alias("session_count"),
        avg("result").alias("avg_performance"),
    ).fillna(0.0)
    
    return weekly_by_type

def create_athlete_training_profile(df_exercise_by_type, df_cardio_weekly):
    """
    Pivot exercise types to columns and join with pre-aggregated cardio data.
    Output: one row per athlete-week with all volume metrics.
    
    Features: volume_strength, volume_mobility, total_km, avg_hr, avg_speed
    """
    
    # Pivot exercises by type
    profile_exercises = df_exercise_by_type.groupBy(
        "athlete_id",
        "year_week"
    ).pivot(
        "exercise_type"
    ).agg(
        sum("total_volume"),
        sum("session_count")
    ).fillna(0.0)
    
    # Rename pivoted columns for clarity
    # Columns like "forza_sum(total_volume)" → "volume_strength"
    profile_exercises_renamed = profile_exercises
    for col_name in profile_exercises.columns:
        if "forza" in col_name and "sum(total_volume)" in col_name:
            profile_exercises_renamed = profile_exercises_renamed.withColumnRenamed(
                col_name, "volume_strength"
            )
        elif "mobilità" in col_name and "sum(total_volume)" in col_name:
            profile_exercises_renamed = profile_exercises_renamed.withColumnRenamed(
                col_name, "volume_mobility"
            )
    
    # Join with cardio data
    profile_complete = profile_exercises_renamed.join(
        df_cardio_weekly,
        on=["athlete_id", "year_week"],
        how="left"
    ).fillna(0.0)
    
    return profile_complete

def calculate_volume_trends(df_profile):
    """Calculate week-over-week changes in volume components"""
    
    w = Window.partitionBy("athlete_id").orderBy("year_week")
    
    df_with_trends = df_profile \
        .withColumn("prev_total_km", lag("total_km_running", 1).over(w)) \
        .withColumn("prev_volume_strength", lag("volume_strength", 1).over(w)) \
        .withColumn("prev_volume_mobility", lag("volume_mobility", 1).over(w)) \
        .withColumn(
            "km_change_pct",
            when(
                (col("prev_total_km").isNull()) | (col("prev_total_km") == 0),
                0.0
            ).otherwise(
                ((col("total_km_running") - col("prev_total_km")) / col("prev_total_km")) * 100
            )
        ) \
        .withColumn(
            "strength_change_pct",
            when(
                (col("prev_volume_strength").isNull()) | (col("prev_volume_strength") == 0),
                0.0
            ).otherwise(
                ((col("volume_strength") - col("prev_volume_strength")) / col("prev_volume_strength")) * 100
            )
        )
    
    return df_with_trends.fillna(0.0)

def perform_kmeans_clustering(df_profile):
    """
    K-Means clustering on balanced training profiles.
    Features: volume_strength, volume_mobility, total_km_running, avg_speed
    """
    
    feature_cols = ["volume_strength", "volume_mobility", "total_km_running", "avg_speed"]
    
    # Ensure all columns exist, fill nulls
    df_clean = df_profile.select("athlete_id", "year_week", *feature_cols).fillna(0.0)
    
    if df_clean.count() < 5:
        print("⚠️  Insufficient data for K-Means")
        return None
    
    # Vector assembler + scaler
    assembler = VectorAssembler(inputCols=feature_cols, outputCol="features")
    df_assembled = assembler.transform(df_clean)
    
    scaler = StandardScaler(inputCol="features", outputCol="scaled_features", withMean=True, withStd=True)
    scaler_model = scaler.fit(df_assembled)
    df_scaled = scaler_model.transform(df_assembled)
    
    # K-Means
    kmeans = KMeans(k=5, seed=42, maxIter=20, featuresCol="scaled_features")
    
    try:
        model = kmeans.fit(df_scaled)
        df_clustered = model.transform(df_scaled)
        
        # Return with cluster assignment
        return df_clustered.select(
            col("athlete_id"),
            col("year_week"),
            col("prediction").alias("cluster_id")
        )
    
    except Exception as e:
        print(f"⚠️  K-Means error: {e}")
        return None

def detect_anomalies(df_profile):
    """
    Detect anomalies in training profiles.
    Flags imbalances or extreme changes in training composition.
    """
    
    anomalies = []
    
    for row in df_profile.collect():
        athlete_id = row["athlete_id"]
        year_week = row["year_week"]
        
        volume_strength = row.get("volume_strength", 0.0) or 0.0
        volume_mobility = row.get("volume_mobility", 0.0) or 0.0
        total_km = row.get("total_km_running", 0.0) or 0.0
        km_change = row.get("km_change_pct", 0.0) or 0.0
        strength_change = row.get("strength_change_pct", 0.0) or 0.0
        
        is_anomaly = False
        reasons = []
        
        total_volume = volume_strength + volume_mobility
        
        # Check 1: High running, low strength (imbalance)
        if total_km > 10 and volume_strength < 5:
            is_anomaly = True
            reasons.append("high_cardio_low_strength")
        
        # Check 2: No mobility despite high intensity
        if (total_km > 10 or volume_strength > 50) and volume_mobility < 5:
            is_anomaly = True
            reasons.append("missing_mobility")
        
        # Check 3: Sudden km spike
        if km_change > 150:
            is_anomaly = True
            reasons.append("cardio_spike")
        
        # Check 4: Sudden strength drop
        if strength_change < -100:
            is_anomaly = True
            reasons.append("strength_drop")
        
        if is_anomaly:
            anomaly_reason = " | ".join(reasons)
            anomalies.append({
                "athlete_id": athlete_id,
                "year_week": year_week,
                "anomaly_reason": anomaly_reason,
            })
    
    return anomalies

def write_results_to_citus(df_clustered, anomalies):
    """Write clustering results and anomalies to Citus"""
    
    if df_clustered is None:
        print("❌ No clustering results")
        return
    
    conn = None
    try:
        import psycopg2
        conn = psycopg2.connect(
            host=os.getenv("CITUS_HOST", "localhost"),
            port=int(os.getenv("CITUS_PORT", 5432)),
            user=os.getenv("CITUS_USER", "postgres"),
            password=os.getenv("CITUS_PASSWORD", "postgres"),
            database=os.getenv("CITUS_DB", "bigintensive"),
        )
        cur = conn.cursor()
        
        # Truncate
        cur.execute("TRUNCATE TABLE exercise_volumes_clusters")
        
        # Build anomaly lookup by athlete-week for efficient inserts
        anomalies_by_key = {
            (a["athlete_id"], a["year_week"]): a["anomaly_reason"]
            for a in anomalies
        }

        # Insert clustering rows aligned with Citus schema
        for row in df_clustered.collect():
            athlete_id = row["athlete_id"]
            year_week = row["year_week"]
            anomaly_reason = anomalies_by_key.get((athlete_id, year_week))
            is_anomaly = anomaly_reason is not None

            cur.execute(
                """INSERT INTO exercise_volumes_clusters 
                   (athlete_id, exercise_type, week_id, cluster_id, is_anomaly, anomaly_reason, timestamp)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (athlete_id, "mixed", year_week, int(row["cluster_id"]), is_anomaly, anomaly_reason, datetime.now())
            )
        
        conn.commit()
        print(f"✅ Wrote {df_clustered.count()} records")
        print(f"✅ Flagged {len(anomalies)} anomalies")
    
    except Exception as e:
        print(f"❌ Error: {e}")
        if conn:
            conn.rollback()
    
    finally:
        if conn:
            cur.close()
            conn.close()

def main():
    print("🚀 Job 3: Volume Clustering by Type + Cardio")
    print(f"   Start: {datetime.now()}")
    print()
    
    try:
        # Read data
        print("📖 Reading exercise types...")
        df_types = read_exercise_types()
        
        print("📖 Reading strength/mobility volumes...")
        df_exercises = read_strength_mobility_volumes()
        print(f"   → {df_exercises.count()} exercise records")
        
        print("📖 Reading weekly cardio aggregates (from Job 1)...")
        df_cardio_weekly = read_weekly_cardio()
        print(f"   → {df_cardio_weekly.count()} weekly cardio records")
        
        # Aggregate
        print("\n⚙️  Aggregating exercise volumes by type...")
        df_by_type = aggregate_exercise_volumes_by_type(df_exercises, df_types)
        
        print("⚙️  Building athlete training profiles...")
        df_profile = create_athlete_training_profile(df_by_type, df_cardio_weekly)
        print(f"   → {df_profile.count()} athlete-week profiles")
        
        print("⚙️  Calculating trends...")
        df_trends = calculate_volume_trends(df_profile)
        
        print("⚙️  K-Means clustering (k=5)...")
        df_clustered = perform_kmeans_clustering(df_trends)
        if df_clustered is not None:
            print(f"   → {df_clustered.count()} clustered")
        
        print("⚙️  Detecting anomalies...")
        anomalies = detect_anomalies(df_trends)
        print(f"   → {len(anomalies)} anomalies")
        
        if anomalies:
            anomaly_counts = {}
            for a in anomalies:
                for reason in a["anomaly_reason"].split(" | "):
                    anomaly_counts[reason] = anomaly_counts.get(reason, 0) + 1
            print("   Breakdown:")
            for reason, count in sorted(anomaly_counts.items()):
                print(f"      • {reason}: {count}")
        
        # Write
        print("\n📝 Writing to Citus...")
        write_results_to_citus(df_clustered, anomalies)
        
        print(f"\n✅ Job 3 done: {datetime.now()}")
    
    except Exception as e:
        print(f"\n❌ Job 3 failed: {e}")
        raise
    
    finally:
        spark.stop()

if __name__ == "__main__":
    main()