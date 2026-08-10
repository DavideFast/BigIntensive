#!/usr/bin/env python3
"""
Job 1: Multi-window Cardio Analysis
Calculates training fatigue, ACWR, HRV, readiness, and injury risk
from smartwatch cardio data using 7 concurrent window functions.

Input:
  - ClickHouse: corsa_endurance_campioni (HR, cadence, speed, altitude, temperature)
  - Citus: injury_history (for Random Forest training)

Output:
  - Citus: training_status_results (ACWR, HRV, readiness, injury_risk_pct, status)
"""

from pyspark.sql import SparkSession, Window
from pyspark.sql.functions import (col, avg, max, min, stddev, lit, when, sum as spark_sum, count)
from pyspark.ml import Pipeline
from pyspark.ml.feature import VectorAssembler, StandardScaler
from pyspark.ml.classification import RandomForestClassifier
import os
from datetime import datetime

####################################################################################################################
###                                                                                                              ###
###                                          INITIALIZE SPARK SESSION                                            ###
###                                                                                                              ###
####################################################################################################################

spark = SparkSession.builder \
    .appName("training-status-job") \
    .config("spark.jars.packages", "org.postgresql:postgresql:42.7.2,com.clickhouse:clickhouse-jdbc:0.6.3") \
    .config("spark.sql.shuffle.partitions", "10") \
    .getOrCreate()

#####################################################################################################################
###                                                                                                               ###
###                                     DATABASE CONNECTIONS AND READING                                          ###
###                                                                                                               ###
#####################################################################################################################

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

# Read cardio samples from ClickHouse
def read_cardio_samples():
    """Read cardio endurance samples from ClickHouse"""
    df = spark.read.jdbc(
        url=CLICKHOUSE_URL,
        table="bigintensive.corsa_endurance_campioni",
        properties=CLICKHOUSE_PROPS,
    )
    return df.select(
        col("atleta_id").cast("integer").alias("athlete_id"),
        col("ts").cast("timestamp").alias("timestamp"),
        col("heart_rate_bpm").cast("double").alias("heart_rate"),
        col("speed_kmh").cast("double").alias("speed"),
        col("cadence_spm").cast("double").alias("cadence"),
        col("altitude_m").cast("double").alias("altitude"),
        col("temperature_c").cast("double").alias("temperature"),
    )

# Read injury history from Citus
def read_injury_history():
    """Read injury history from Citus for ML training"""
    df = spark.read.jdbc(
        url=CITUS_URL,
        table="injury_history",
        properties=CITUS_PROPS,
    )
    return df.select(
        col("athlete_id").cast("integer"),
        col("injury_date").cast("date"),
        col("severity"),
        col("pre_injury_acwr").cast("double"),
        col("pre_injury_hrv").cast("double"),
        col("pre_injury_load").cast("integer"),
    )


######################################################################################################################
###                                                                                                               ###
###                                     DATA PROCESSING AND METRICS CALCULATION                                   ###
###                                                                                                               ###
######################################################################################################################

def calculate_trimp(df):
    """
    Calculate Training Impulse (TRIMP) for each session.
    TRIMP = Duration (minutes) × Average HR × Intensity Factor
    where Intensity Factor = (HR_avg - HR_rest) / (HR_max - HR_rest)
    Assumes HR_rest=60 bpm, HR_max=200 bpm (can be athlete-specific)
    """
    # Group by athlete and session (session_id is inferred from time continuity)
    # For now, we'll aggregate by athlete and day as a session proxy
    
    df_with_date = df.withColumn("date", col("timestamp").cast("date"))
    
    # Daily aggregations (treating each day as a training session)
    daily = df_with_date.groupBy("athlete_id", "date").agg(
        avg("heart_rate").alias("hr_avg"),
        max("heart_rate").alias("hr_max"),
        min("heart_rate").alias("hr_min"),
        stddev("heart_rate").alias("hrv"),  # HRV as HR standard deviation
        avg("speed").alias("speed_avg"),
        avg("cadence").alias("cadence_avg"),
        (max("timestamp") - min("timestamp")).cast("long").alias("duration_sec"),  # Duration in seconds
    )
    
    # Calculate TRIMP
    hr_rest = 60.0
    hr_max = 200.0
    
    daily = daily.withColumn(
        "intensity_factor",
        when(
            (col("hr_avg") - lit(hr_rest)) / (lit(hr_max) - lit(hr_rest)) > 0,
            (col("hr_avg") - lit(hr_rest)) / (lit(hr_max) - lit(hr_rest))
        ).otherwise(0.0)
    ).withColumn(
        "trimp",
        (col("duration_sec") / 60.0) * col("hr_avg") * col("intensity_factor")
    )
    
    return daily.withColumnRenamed("date", "training_date")

def apply_window_functions(df_daily):
    """Apply 7 window functions for multi-temporal analysis"""
    
    # Define windows: 3, 7, 14, 28, 42, 90, 365 days
    window_sizes = [3, 7, 14, 28, 42, 90, 365]
    
    # Sort by athlete and date for windowing
    w_base = Window.partitionBy("athlete_id").orderBy("training_date")
    
    df_result = df_daily
    
    for days in window_sizes:
        w = Window.partitionBy("athlete_id").orderBy(
            col("training_date").cast("long")
        ).rangeBetween(-86400 * (days - 1), 0)  # days in seconds
        
        alias_trimp = f"trimp_{days}d"
        alias_hr_avg = f"hr_avg_{days}d"
        alias_hr_max = f"hr_max_{days}d"
        alias_hrv = f"hrv_{days}d"
        
        df_result = df_result \
            .withColumn(alias_trimp, spark_sum("trimp").over(w)) \
            .withColumn(alias_hr_avg, avg("hr_avg").over(w)) \
            .withColumn(alias_hr_max, max("hr_max").over(w)) \
            .withColumn(alias_hrv, stddev("hrv").over(w))
    
    return df_result

def calculate_derived_metrics(df_windowed):
    """Calculate ACWR, readiness, and status"""
    
    df_result = df_windowed.withColumn(
        "acwr",
        when(col("trimp_28d") > 0, col("trimp_7d") / col("trimp_28d")).otherwise(0.0)
    )
    
    # Readiness Score: 0-100 scale
    # Higher ACWR (>1.5) = amber/red; Lower HRV = fatigue = amber/red; High HR trend = overtraining
    df_result = df_result.withColumn(
        "readiness_score",
        when(col("acwr").isNull(), 50).otherwise(
            when(col("acwr") > 1.5, 30)  # Overtraining
            .when(col("acwr") < 0.8, 40)  # Under-stimulated
            .otherwise(75)  # Optimal
        )
    )
    
    # Status: green/amber/red
    df_result = df_result.withColumn(
        "status",
        when(col("readiness_score") >= 70, "green")
        .when(col("readiness_score") >= 50, "amber")
        .otherwise("red")
    )
    
    return df_result

def train_injury_risk_model(df_results, df_injuries):
    """Train Random Forest classifier for injury risk prediction"""
    
    # Create injury labels: 1 if injury occurred within 7 days, 0 otherwise
    df_injuries_labeled = df_injuries.withColumn(
        "injury_window_start",
        col("injury_date") - 7
    ).withColumn(
        "injury_window_end",
        col("injury_date")
    )
    
    # Join results with injury windows
    df_with_injury_label = df_results.join(
        df_injuries_labeled.select(
            "athlete_id",
            "injury_window_start",
            "injury_window_end",
            "pre_injury_acwr",
            "pre_injury_hrv",
            "pre_injury_load"
        ),
        (df_results.athlete_id == df_injuries_labeled.athlete_id) &
        (df_results.training_date >= df_injuries_labeled.injury_window_start) &
        (df_results.training_date <= df_injuries_labeled.injury_window_end),
        "left"
    )
    
    # Label: 1 if injury in window, 0 otherwise
    df_with_injury_label = df_with_injury_label.withColumn(
        "injury_label",
        when(col("pre_injury_acwr").isNotNull(), 1).otherwise(0)
    )
    
    # Select features for ML
    feature_cols = [
        "acwr", "trimp_7d", "trimp_28d", "hr_avg_7d", "hr_max_7d", "hrv_7d"
    ]
    
    # Handle nulls
    for col_name in feature_cols:
        df_with_injury_label = df_with_injury_label.withColumn(
            col_name,
            when(col(col_name).isNull(), 0.0).otherwise(col(col_name))
        )
    
    # Vector assembler
    assembler = VectorAssembler(
        inputCols=feature_cols,
        outputCol="features"
    )
    
    # Scaler
    scaler = StandardScaler(
        inputCol="features",
        outputCol="scaled_features",
        withMean=True,
        withStd=True
    )
    
    # Random Forest
    rf = RandomForestClassifier(
        featuresCol="scaled_features",
        labelCol="injury_label",
        numTrees=10,
        maxDepth=5,
        seed=42
    )
    
    pipeline = Pipeline(stages=[assembler, scaler, rf])
    
    try:
        model = pipeline.fit(df_with_injury_label.select("acwr", "trimp_7d", "trimp_28d", "hr_avg_7d", "hr_max_7d", "hrv_7d", "injury_label"))
        return model
    except Exception as e:
        print(f"⚠️  Could not train injury risk model: {e}")
        return None

def predict_injury_risk(df_results, model):
    """Add injury risk predictions to results"""
    
    if model is None:
        df_results = df_results.withColumn("injury_risk_pct", lit(50.0))
        return df_results
    
    # Prepare features
    feature_cols = [
        "acwr", "trimp_7d", "trimp_28d", "hr_avg_7d", "hr_max_7d", "hrv_7d"
    ]
    
    for col_name in feature_cols:
        df_results = df_results.withColumn(
            col_name,
            when(col(col_name).isNull(), 0.0).otherwise(col(col_name))
        )
    
    assembler = VectorAssembler(inputCols=feature_cols, outputCol="features")
    scaler = StandardScaler(
        inputCol="features",
        outputCol="scaled_features",
        withMean=True,
        withStd=True
    )
    
    pipeline = Pipeline(stages=[assembler, scaler])
    df_scaled = pipeline.fit(df_results).transform(df_results)
    
    # Predict
    df_predictions = model.transform(df_scaled)
    
    # Extract probability of injury (class 1)
    df_results = df_results.join(
        df_predictions.select(
            "athlete_id",
            "training_date",
            col("probability").getItem(1).alias("injury_risk_pct")
        ),
        ["athlete_id", "training_date"],
        "left"
    )
    
    df_results = df_results.withColumn(
        "injury_risk_pct",
        (col("injury_risk_pct") * 100).cast("decimal(5,2)")
    )
    
    return df_results

def write_results_to_citus(df_results):
    """Write results to training_status_results table in Citus"""
    
    # Select final columns
    df_output = df_results.select(
        col("athlete_id"),
        col("training_date").alias("result_date"),
        col("acwr").cast("decimal(5,2)"),
        col("hrv_7d").cast("decimal(5,3)").alias("hrv"),
        col("readiness_score").cast("integer").alias("readiness"),
        col("injury_risk_pct"),
        col("status"),
        col("trimp_3d").cast("decimal(10,2)"),
        col("trimp_7d").cast("decimal(10,2)"),
        col("trimp_28d").cast("decimal(10,2)"),
        col("trimp_42d").cast("decimal(10,2)"),
    ).distinct()
    
    # Truncate and insert (or upsert if Citus supports it)
    try:
        df_output.write \
            .mode("overwrite") \
            .jdbc(
                url=CITUS_URL,
                table="training_status_results",
                properties=CITUS_PROPS,
            )
        print(f"✅ Successfully wrote {df_output.count()} records to training_status_results")
    except Exception as e:
        print(f"❌ Error writing results to Citus: {e}")
        raise

def calculate_weekly_cardio_aggregates(df_daily, df_cardio):
    """
    Calculate weekly cardio aggregates from daily data and raw samples.
    Outputs: athlete_id, year_week, total_km, avg_hr, max_hr, avg_hrv, avg_speed
    """
    from pyspark.sql.functions import year, weekofyear, concat_ws
    
    # Weekly aggregation from daily TRIMP data
    df_with_week = df_daily.withColumn(
        "year_week",
        concat_ws("-", year("training_date"), weekofyear("training_date"))
    )
    
    weekly = df_with_week.groupBy("athlete_id", "year_week").agg(
        spark_sum("trimp").alias("total_trimp"),
        avg("hr_avg").alias("avg_hr"),
        max("hr_max").alias("max_hr"),
        avg("hrv").alias("avg_hrv"),
        avg("speed_avg").alias("avg_speed"),
        count("*").alias("session_count"),
    ).fillna(0.0)
    
    # Calculate distance from speed and duration
    df_cardio_week = df_cardio.withColumn(
        "year_week",
        concat_ws("-", year(col("timestamp").cast("date")), weekofyear(col("timestamp").cast("date")))
    )
    
    # Approx: distance = avg_speed * (duration_hours)
    # Group by athlete-week and sum duration, avg speed
    cardio_distance = df_cardio_week.groupBy("athlete_id", "year_week").agg(
        (avg("speed") * (count("*") * 5 / 3600.0)).alias("total_km_running")  # 5sec per sample
    )
    
    # Join
    weekly = weekly.join(
        cardio_distance,
        on=["athlete_id", "year_week"],
        how="left"
    ).fillna(0.0)
    
    return weekly

def write_weekly_aggregates_to_citus(df_weekly):
    """Write weekly cardio aggregates to Citus"""
    
    try:
        df_output = df_weekly.select(
            col("athlete_id"),
            col("year_week").alias("week_id"),
            col("total_trimp").cast("decimal(10,2)"),
            col("total_km_running").cast("decimal(8,2)"),
            col("avg_hr").cast("decimal(6,2)"),
            col("max_hr").cast("integer"),
            col("avg_hrv").cast("decimal(6,3)"),
            col("avg_speed").cast("decimal(6,2)"),
            col("session_count").cast("integer"),
        ).distinct()
        
        df_output.write \
            .mode("overwrite") \
            .jdbc(
                url=CITUS_URL,
                table="weekly_cardio_aggregates",
                properties=CITUS_PROPS,
            )
        print(f"✅ Wrote {df_output.count()} weekly cardio aggregates")
    
    except Exception as e:
        print(f"❌ Error writing weekly aggregates: {e}")

def main():
    print("🚀 Job 1: Multi-window Cardio Analysis (Training Status)")
    print(f"   Start time: {datetime.now()}")
    print()
    
    try:
        # 1. Read data
        print("📖 Reading cardio samples from ClickHouse...")
        df_cardio = read_cardio_samples()
        print(f"   → {df_cardio.count()} samples read")
        
        print("📖 Reading injury history from Citus...")
        df_injuries = read_injury_history()
        print(f"   → {df_injuries.count()} injury records read")
        
        # 2. Calculate daily TRIMP
        print("\n⚙️  Calculating daily TRIMP...")
        df_daily = calculate_trimp(df_cardio)
        print(f"   → {df_daily.count()} daily aggregates")
        
        # 3. Apply 7 window functions
        print("\n⚙️  Applying 7 window functions (3d, 7d, 14d, 28d, 42d, 90d, 365d)...")
        df_windowed = apply_window_functions(df_daily)
        print("   → Windows applied")
        
        # 4. Calculate derived metrics
        print("\n⚙️  Calculating ACWR, readiness, and status...")
        df_with_metrics = calculate_derived_metrics(df_windowed)
        print("   → Metrics calculated")
        
        # 5. Train injury risk model
        print("\n⚙️  Training injury risk model...")
        model = train_injury_risk_model(df_with_metrics, df_injuries)
        
        # 6. Predict injury risk
        print("\n⚙️  Predicting injury risk...")
        df_final = predict_injury_risk(df_with_metrics, model)
        
        # 7. Write to Citus
        print("\n📝 Writing results to Citus...")
        write_results_to_citus(df_final)
        
        # 8. Calculate and save weekly aggregates
        print("\n📝 Calculating and writing weekly cardio aggregates...")
        df_weekly = calculate_weekly_cardio_aggregates(df_daily, df_cardio)
        write_weekly_aggregates_to_citus(df_weekly)
        
        print(f"\n✅ Job 1 completed successfully at {datetime.now()}")
    
    except Exception as e:
        print(f"\n❌ Job 1 failed: {e}")
        raise
    finally:
        spark.stop()

if __name__ == "__main__":
    main()
