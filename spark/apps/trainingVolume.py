#!/usr/bin/env python3
"""
Job 3: Training Volume Clustering & Anomaly Detection
Aggregates exercise volumes by type (strength, mobility) and running distance,
performs K-Means clustering on balanced training profiles, and detects anomalies.

Input:
  - ClickHouse: allenamento_dettagli (strength/mobility exercises)
  - ClickHouse: corsa_endurance_campioni (running cardio)
  - Citus: exercises (reference data with exercise types)

Output:
  - Citus: exercise_volumes_clusters (athlete profile, cluster, anomaly flags)
"""

from pyspark.sql import SparkSession, Window
from pyspark.sql.functions import (
    col, sum, avg, max, count, stddev, when, lag, lead, concat_ws,
    year, weekofyear, lit
)
from pyspark.ml.feature import VectorAssembler, StandardScaler
from pyspark.ml.clustering import KMeans
import os
from datetime import datetime

#######################################################################################################################
###                                                                                                                 ###
###                                          INITIALIZE SPARK SESSION                                               ###
###                                                                                                                 ###
#######################################################################################################################

spark = SparkSession.builder \
    .appName("job3-training-volume-clustering") \
    .config("spark.jars.packages", "org.postgresql:postgresql:42.7.2,com.clickhouse:clickhouse-jdbc:0.6.3") \
    .config("spark.sql.shuffle.partitions", "10") \
    .getOrCreate()

#######################################################################################################################
###                                                                                                                 ###
###                                          DATABASE CONNECTIONS                                                   ###
###                                                                                                                 ###
#######################################################################################################################


CITUS_URL = os.getenv("CITUS_JDBC_URL", "jdbc:postgresql://localhost:5432/bigintensive")
CITUS_PROPS = {
    "user": os.getenv("CITUS_USER", "postgres"),
    "password": os.getenv("CITUS_PASSWORD", "postgres"),
    "driver": "org.postgresql.Driver",
}

CLICKHOUSE_URL = os.getenv("CLICKHOUSE_JDBC_URL", "jdbc:clickhouse://localhost:8123/bigintensive")
CLICKHOUSE_PROPS = {
    "user": os.getenv("CLICKHOUSE_USER", "default"),
    "password": os.getenv("CLICKHOUSE_PASSWORD", ""),
    "driver": "com.clickhouse.jdbc.ClickHouseDriver",
}

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

def read_running_volumes():
    """Read running/cardio sessions from ClickHouse"""
    df = spark.read.jdbc(
        url=CLICKHOUSE_URL,
        table="bigintensive.corsa_endurance_campioni",
        properties=CLICKHOUSE_PROPS,
    )
    return df.select(
        col("atleta_id").cast("integer").alias("athlete_id"),
        col("ts").cast("date").alias("training_date"),
        col("speed_kmh").cast("double").alias("speed_kmh"),
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

def aggregate_running_volumes(df_running):
    """
    Aggregate running distance by athlete and week.
    Calculates: total km, avg speed, session count
    """
    
    # Add year-week column
    df_with_week = df_running.withColumn(
        "year_week",
        concat_ws("-", year("training_date"), weekofyear("training_date"))
    )
    
    # Assume 1 sample every 5 sec and duration 30 min per session
    # Speed is in km/h, so distance per sample = speed_kmh * (5sec / 3600sec)
    df_with_distance = df_with_week.withColumn(
        "distance_km",
        col("speed_kmh") * (5.0 / 3600.0)
    )
    
    # Group by athlete and week
    weekly_running = df_with_distance.groupBy(
        "athlete_id",
        "year_week"
    ).agg(
        sum("distance_km").alias("total_km_running"),
        avg("speed_kmh").alias("avg_speed_kmh"),
        count("*").alias("sample_count"),
    ).fillna(0.0)
    
    return weekly_running

def create_athlete_training_profile(df_by_type, df_running):
    """
    Pivot exercise types to columns and join with running data.
    Output: one row per athlete-week with all volume metrics
    """
    
    # Pivot exercises by type
    profile_exercises = df_by_type.groupBy(
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
    
    # Join with running data
    profile_complete = profile_exercises_renamed.join(
        df_running,
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
    Features: volume_strength, volume_mobility, total_km_running, avg_speed_kmh
    """
    
    feature_cols = ["volume_strength", "volume_mobility", "total_km_running", "avg_speed_kmh"]
    
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
        
        # Insert clustering
        for row in df_clustered.collect():
            cur.execute(
                """INSERT INTO exercise_volumes_clusters 
                   (athlete_id, volume_week, cluster_id, is_anomaly, anomaly_reason, timestamp)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (row["athlete_id"], row["year_week"], int(row["cluster_id"]), False, None, datetime.now())
            )
        
        # Update anomalies
        for anomaly in anomalies:
            cur.execute(
                """UPDATE exercise_volumes_clusters 
                   SET is_anomaly = %s, anomaly_reason = %s
                   WHERE athlete_id = %s AND volume_week = %s""",
                (True, anomaly["anomaly_reason"], anomaly["athlete_id"], anomaly["year_week"])
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
    print("🚀 Job 3: Volume Clustering by Type + Running")
    print(f"   Start: {datetime.now()}")
    print()
    
    try:
        # Read data
        print("📖 Reading exercise types...")
        df_types = read_exercise_types()
        
        print("📖 Reading strength/mobility volumes...")
        df_exercises = read_strength_mobility_volumes()
        print(f"   → {df_exercises.count()} exercise records")
        
        print("📖 Reading running volumes...")
        df_running_raw = read_running_volumes()
        print(f"   → {df_running_raw.count()} running samples")
        
        # Aggregate
        print("\n⚙️  Aggregating by exercise type...")
        df_by_type = aggregate_exercise_volumes_by_type(df_exercises, df_types)
        
        print("⚙️  Aggregating running distance...")
        df_running_agg = aggregate_running_volumes(df_running_raw)
        
        print("⚙️  Building athlete training profiles...")
        df_profile = create_athlete_training_profile(df_by_type, df_running_agg)
        print(f"   → {df_profile.count()} athlete-week profiles")
        
        print("⚙️  Calculating trends...")
        df_trends = calculate_volume_trends(df_profile)
        
        print("⚙️  K-Means clustering (k=5)...")
        df_clustered = perform_kmeans_clustering(df_trends)
        if df_clustered:
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


#####################################################################################################################
###                                                                                                               ###
###                                          INITIALIZE SPARK SESSION                                             ###
###                                                                                                               ###
#####################################################################################################################

spark = SparkSession.builder \
    .appName("job3-training-volume-clustering") \
    .config("spark.jars.packages", "org.postgresql:postgresql:42.7.2,com.clickhouse:clickhouse-jdbc:0.6.3") \
    .config("spark.sql.shuffle.partitions", "10") \
    .getOrCreate()

######################################################################################################################
###                                                                                                                ###
###                                          DATABASE CONNECTIONS                                                  ###
###                                                                                                                ###
######################################################################################################################


CITUS_URL = os.getenv("CITUS_JDBC_URL", "jdbc:postgresql://localhost:5432/bigintensive")
CITUS_PROPS = {
    "user": os.getenv("CITUS_USER", "postgres"),
    "password": os.getenv("CITUS_PASSWORD", "postgres"),
    "driver": "org.postgresql.Driver",
}

CLICKHOUSE_URL = os.getenv("CLICKHOUSE_JDBC_URL", "jdbc:clickhouse://localhost:8123/bigintensive")
CLICKHOUSE_PROPS = {
    "user": os.getenv("CLICKHOUSE_USER", "default"),
    "password": os.getenv("CLICKHOUSE_PASSWORD", ""),
    "driver": "com.clickhouse.jdbc.ClickHouseDriver",
}

def read_exercise_volumes():
    """Read exercise sessions from ClickHouse"""
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

######################################################################################################################
###                                                                                                                ###
###                                          DATA PROCESSING AND METRICS CALCULATION                               ###
###                                                                                                                ###
######################################################################################################################

def aggregate_weekly_volumes(df_exercises):
    """
    Aggregate exercise volumes by athlete and week.
    Calculate total volume (sets × reps × result), session count, intensity.
    """
    
    # Add year-week column
    df_with_week = df_exercises.withColumn(
        "year_week",
        concat_ws("-", year("training_date"), weekofyear("training_date"))
    )
    
    # Calculate volume per exercise session
    df_with_volume = df_with_week.withColumn(
        "volume_metric",
        col("sets") * col("reps") * col("result")
    )
    
    # Weekly aggregation by athlete and exercise type
    weekly_agg = df_with_volume.groupBy(
        "athlete_id",
        "year_week",
        "exercise_id"
    ).agg(
        sum("volume_metric").alias("total_volume"),
        sum("sets").alias("total_sets"),
        count("*").alias("session_count"),
        avg("result").alias("avg_performance"),
        max("result").alias("max_performance"),
    )
    
    # Pivot to get one row per athlete-week
    athlete_week_volumes = weekly_agg.groupBy(
        "athlete_id",
        "year_week"
    ).agg(
        sum("total_volume").alias("total_weekly_volume"),
        sum("total_sets").alias("total_weekly_sets"),
        count("*").alias("exercise_variety"),  # number of different exercises
        avg("avg_performance").alias("avg_weekly_performance"),
    )
    
    return athlete_week_volumes

def calculate_volume_metrics(df_volumes):
    """
    Calculate derived metrics for anomaly detection:
    - Week-over-week change in volume
    - Volume consistency (stddev within athlete)
    - Intensity trend
    """
    
    w = Window.partitionBy("athlete_id").orderBy("year_week")
    
    df_with_trend = df_volumes \
        .withColumn(
            "prev_volume",
            lag("total_weekly_volume", 1).over(w)
        ) \
        .withColumn(
            "next_volume",
            lead("total_weekly_volume", 1).over(w)
        ) \
        .withColumn(
            "volume_change_pct",
            when(
                (col("prev_volume").isNull()) | (col("prev_volume") == 0),
                0.0
            ).otherwise(
                ((col("total_weekly_volume") - col("prev_volume")) / col("prev_volume")) * 100
            )
        )
    
    # Calculate rolling statistics per athlete
    w_rolling = Window.partitionBy("athlete_id").orderBy("year_week").rangeBetween(-21, 0)
    
    df_with_stats = df_with_trend \
        .withColumn(
            "rolling_avg_volume",
            avg("total_weekly_volume").over(w_rolling)
        ) \
        .withColumn(
            "rolling_std_volume",
            stddev("total_weekly_volume").over(w_rolling)
        ) \
        .withColumn(
            "deviation_from_rolling_avg",
            when(
                col("rolling_std_volume").isNull() | (col("rolling_std_volume") == 0),
                0.0
            ).otherwise(
                (col("total_weekly_volume") - col("rolling_avg_volume")) / col("rolling_std_volume")
            )
        )
    
    return df_with_stats.fillna(0.0)

def perform_kmeans_clustering(df_metrics):
    """
    Perform K-Means clustering (k=5) to group athletes by training profile.
    Feature vector: total volume, exercise variety, avg performance.
    """
    
    feature_cols = ["total_weekly_volume", "exercise_variety", "avg_weekly_performance"]
    
    # Remove rows with null values
    df_clean = df_metrics.select(feature_cols).fillna(0.0)
    
    if df_clean.count() < 5:
        print("⚠️  Insufficient data for K-Means clustering")
        return None
    
    # Vector assembler
    assembler = VectorAssembler(
        inputCols=feature_cols,
        outputCol="features"
    )
    df_assembled = assembler.transform(df_clean)
    
    # Scaler
    scaler = StandardScaler(
        inputCol="features",
        outputCol="scaled_features",
        withMean=True,
        withStd=True
    )
    scaler_model = scaler.fit(df_assembled)
    df_scaled = scaler_model.transform(df_assembled)
    
    # K-Means
    kmeans = KMeans(
        k=5,
        seed=42,
        maxIter=20,
        featuresCol="scaled_features"
    )
    
    try:
        model = kmeans.fit(df_scaled)
        
        # Add predictions
        df_clustered = model.transform(df_scaled).select(col("prediction").alias("cluster_id"))
        
        # Combine back with original data
        df_result = df_metrics.select("athlete_id", "year_week").withColumn(
            "cluster_id",
            df_clustered.select("cluster_id")
        )
        
        return df_result
    
    except Exception as e:
        print(f"⚠️  K-Means error: {e}")
        return None

def detect_anomalies(df_metrics):
    """
    Isolation Forest-like anomaly detection using statistical thresholds.
    Flags: overtraining, fatigue, recovery_issue, bilateral_imbalance
    
    Thresholds (in σ):
      - Volume change > 2.5σ → overtraining (sudden spike)
      - Volume decrease > -2σ → fatigue/undertraining
      - Deviation from rolling avg > 2.5σ → anomaly
    """
    
    anomalies = []
    
    for row in df_metrics.collect():
        athlete_id = row["athlete_id"]
        year_week = row["year_week"]
        volume_change = row["volume_change_pct"]
        deviation = row["deviation_from_rolling_avg"]
        
        is_anomaly = False
        reasons = []
        
        # Check 1: Sudden volume spike (overtraining)
        if abs(volume_change) > 2.5 * 100:  # 2.5σ ≈ 250% change
            is_anomaly = True
            if volume_change > 0:
                reasons.append("overtraining_spike")
            else:
                reasons.append("sudden_decrease")
        
        # Check 2: Large deviation from rolling average
        if abs(deviation) > 2.5:
            is_anomaly = True
            if deviation > 2.5:
                reasons.append("high_intensity_anomaly")
            else:
                reasons.append("low_volume_anomaly")
        
        # Check 3: Consecutive decreases (fatigue pattern)
        if volume_change < -1.5 * 100:  # -150% change
            is_anomaly = True
            reasons.append("fatigue_pattern")
        
        if is_anomaly:
            anomaly_reason = " | ".join(reasons)
            anomalies.append({
                "athlete_id": athlete_id,
                "year_week": year_week,
                "is_anomaly": True,
                "anomaly_reason": anomaly_reason,
            })
    
    return anomalies

def write_results_to_citus(df_results, anomalies):
    """Write clustering and anomaly results to Citus"""
    
    if df_results is None:
        print("❌ No clustering results to write")
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
        
        # Truncate table
        cur.execute("TRUNCATE TABLE exercise_volumes_clusters")
        
        # Insert clustering results (not anomalies)
        for row in df_results.collect():
            cur.execute(
                """INSERT INTO exercise_volumes_clusters 
                   (athlete_id, volume_week, cluster_id, is_anomaly, anomaly_reason, timestamp)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (
                    row["athlete_id"],
                    row["year_week"],
                    int(row["cluster_id"]),
                    False,  # Will be updated by anomaly detection
                    None,
                    datetime.now()
                )
            )
        
        # Update with anomalies
        for anomaly in anomalies:
            cur.execute(
                """UPDATE exercise_volumes_clusters 
                   SET is_anomaly = %s, anomaly_reason = %s
                   WHERE athlete_id = %s AND volume_week = %s""",
                (
                    True,
                    anomaly["anomaly_reason"],
                    anomaly["athlete_id"],
                    anomaly["year_week"]
                )
            )
        
        conn.commit()
        print(f"✅ Successfully wrote {df_results.count()} clustering records to Citus")
        print(f"✅ Flagged {len(anomalies)} anomalies")
    
    except Exception as e:
        print(f"❌ Error writing results: {e}")
        if conn:
            conn.rollback()
    
    finally:
        if conn:
            cur.close()
            conn.close()

def main():
    print("🚀 Job 3: Training Volume Clustering & Anomaly Detection")
    print(f"   Start time: {datetime.now()}")
    print()
    
    try:
        # 1. Read data
        print("📖 Reading exercise volumes from ClickHouse...")
        df_volumes = read_exercise_volumes()
        print(f"   → {df_volumes.count()} exercise records read")
        
        # 2. Aggregate weekly volumes
        print("\n⚙️  Aggregating weekly volumes by athlete...")
        df_weekly = aggregate_weekly_volumes(df_volumes)
        print(f"   → {df_weekly.count()} athlete-week records")
        
        # 3. Calculate metrics for clustering
        print("\n⚙️  Calculating volume metrics and trends...")
        df_metrics = calculate_volume_metrics(df_weekly)
        print(f"   → Added rolling statistics and deviation metrics")
        
        # 4. K-Means clustering
        print("\n⚙️  Performing K-Means clustering (k=5)...")
        df_clustered = perform_kmeans_clustering(df_metrics)
        if df_clustered:
            print(f"   → {df_clustered.count()} records clustered")
        
        # 5. Anomaly detection
        print("\n⚙️  Detecting anomalies via statistical thresholds...")
        anomalies = detect_anomalies(df_metrics)
        print(f"   → {len(anomalies)} anomalies detected")
        
        if anomalies:
            print("   → Anomaly breakdown:")
            anomaly_types = {}
            for a in anomalies:
                for reason in a["anomaly_reason"].split(" | "):
                    anomaly_types[reason] = anomaly_types.get(reason, 0) + 1
            for atype, count in sorted(anomaly_types.items()):
                print(f"      • {atype}: {count}")
        
        # 6. Write results
        print("\n📝 Writing results to Citus...")
        if df_clustered:
            write_results_to_citus(df_clustered, anomalies)
        
        print(f"\n✅ Job 3 completed successfully at {datetime.now()}")
    
    except Exception as e:
        print(f"\n❌ Job 3 failed: {e}")
        raise
    
    finally:
        spark.stop()

if __name__ == "__main__":
    main()