#!/usr/bin/env python3
"""
Job 2: Exercise Correlation Analysis
Calculates Pearson correlation matrix between exercises to show which exercises
improve together (e.g., squat vs medicine ball throw).

Input:
  - ClickHouse: allenamento_dettagli (exercise performance per athlete)

Output:
  - Citus: exercise_correlations (exercise1_id, exercise2_id, correlation_coefficient)
"""

from pyspark.sql import SparkSession, Window
from pyspark.sql.functions import (
    col, max, avg, when, lag, count
)
from pyspark.ml.feature import VectorAssembler, StandardScaler
from pyspark.ml.stat import Correlation
import os
from datetime import datetime

######################################################################################################################
###                                                                                                                ###
###                                          INITIALIZE SPARK SESSION                                              ###
###                                                                                                                ###
######################################################################################################################


spark = SparkSession.builder \
    .appName("job2-exercise-correlation") \
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

def read_exercise_metrics():
    """Read exercise details from ClickHouse"""
    df = spark.read.jdbc(
        url=CLICKHOUSE_URL,
        table="bigintensive.allenamento_dettagli",
        properties=CLICKHOUSE_PROPS,
    )
    return df.select(
        col("atleta_id").cast("integer").alias("athlete_id"),
        col("ts").cast("date").alias("training_date"),
        col("esercizio_id").cast("integer").alias("exercise_id"),
        col("risultato").cast("double").alias("performance"),
    )

def read_exercises_reference():
    """Read exercise reference data from Citus"""
    df = spark.read.jdbc(
        url=CITUS_URL,
        table="exercises",
        properties=CITUS_PROPS,
    )
    return df.select(
        col("exercise_id"),
        col("nome_esercizio").alias("exercise_name"),
    )

#######################################################################################################################
###                                                                                                                 ###
###                                          DATA PROCESSING AND METRICS CALCULATION                                ###
###                                                                                                                 ###
#######################################################################################################################

def aggregate_exercise_metrics(df_metrics):
    """
    Aggregate exercise metrics by athlete, exercise, and week.
    Calculate weekly performance per exercise.
    """
    df_with_week = df_metrics.withColumn(
        "year_week",
        col("training_date").cast("string").substr(1, 10)  # YYYY-MM-DD for simple grouping
    )
    
    # Weekly aggregation by exercise
    weekly_agg = df_with_week.groupBy(
        "athlete_id", "year_week", "exercise_id"
    ).agg(
        max("performance").alias("max_perf"),
        avg("performance").alias("avg_perf"),
        count("*").alias("rep_count"),
    )
    
    return weekly_agg

def calculate_correlation_matrix(df_agg):
    """
    Calculate Pearson correlation between exercises.
    Pivot exercises as columns (performance values), then compute correlation.
    Returns: list of (exercise1_id, exercise2_id, correlation_coefficient)
    """
    
    # Pivot exercises to columns
    pivot_df = df_agg.select(
        "athlete_id", "year_week", "exercise_id", "max_perf"
    ).groupBy(
        "athlete_id", "year_week"
    ).pivot(
        "exercise_id"
    ).agg(
        avg("max_perf")
    ).fillna(0.0)
    
    # Get exercise columns (all except athlete_id, year_week)
    exercise_cols = [c for c in pivot_df.columns if c not in ["athlete_id", "year_week"]]
    
    if len(exercise_cols) < 2:
        print("⚠️  Insufficient exercises for correlation")
        return []
    
    # Assemble features
    assembler = VectorAssembler(inputCols=exercise_cols, outputCol="features")
    df_features = assembler.transform(pivot_df).select("features")
    
    # Calculate Pearson correlation matrix
    try:
        corr_matrix = Correlation.corr(df_features, "features", "pearson").head()[0]
        corr_array = corr_matrix.toArray()
        
        # Extract significant correlations (> 0.3 or < -0.3)
        correlations = []
        for i in range(len(exercise_cols)):
            for j in range(i + 1, len(exercise_cols)):
                corr_val = float(corr_array[i][j])
                
                # Only keep significant correlations
                if abs(corr_val) > 0.3:
                    exercise1_id = int(exercise_cols[i])
                    exercise2_id = int(exercise_cols[j])
                    correlations.append({
                        "exercise1_id": exercise1_id,
                        "exercise2_id": exercise2_id,
                        "correlation": round(corr_val, 4)
                    })
        
        return correlations
    
    except Exception as e:
        print(f"⚠️  Error computing correlation: {e}")
        return []

def write_results_to_citus(correlations):
    """Write exercise correlations to Citus"""
    
    if not correlations:
        print("❌ No significant correlations found")
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
        
        # Truncate table (create if not exists)
        try:
            cur.execute("TRUNCATE TABLE exercise_correlations")
        except:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS exercise_correlations (
                    corr_id SERIAL PRIMARY KEY,
                    exercise1_id INTEGER,
                    exercise2_id INTEGER,
                    correlation_coefficient DECIMAL(5,4),
                    timestamp TIMESTAMP DEFAULT NOW()
                )
            """)
        
        # Insert correlations
        for corr in correlations:
            cur.execute(
                """INSERT INTO exercise_correlations (exercise1_id, exercise2_id, correlation_coefficient)
                   VALUES (%s, %s, %s)""",
                (corr["exercise1_id"], corr["exercise2_id"], corr["correlation"])
            )
        
        conn.commit()
        print(f"✅ Wrote {len(correlations)} significant exercise correlations to Citus")
        print("   Correlations (|r| > 0.3):")
        for corr in correlations[:10]:  # Show first 10
            print(f"      Exercise {corr['exercise1_id']} ↔ {corr['exercise2_id']}: {corr['correlation']:.4f}")
    
    except Exception as e:
        print(f"❌ Error writing results: {e}")
        if conn:
            conn.rollback()
    
    finally:
        if conn:
            cur.close()
            conn.close()

def main():
    print("🚀 Job 2: Exercise Correlation Analysis")
    print(f"   Start: {datetime.now()}")
    print()
    
    try:
        # 1. Read exercise metrics
        print("📖 Reading exercise metrics from ClickHouse...")
        df_metrics = read_exercise_metrics()
        print(f"   → {df_metrics.count()} metrics read")
        
        # 2. Aggregate by week
        print("\n⚙️  Aggregating exercise metrics by week...")
        df_agg = aggregate_exercise_metrics(df_metrics)
        print(f"   → {df_agg.count()} weekly records")
        
        # 3. Calculate correlation matrix
        print("\n⚙️  Computing Pearson correlation matrix...")
        correlations = calculate_correlation_matrix(df_agg)
        print(f"   → {len(correlations)} significant correlations (|r| > 0.3)")
        
        # 4. Write results
        print("\n📝 Writing correlations to Citus...")
        write_results_to_citus(correlations)
        
        print(f"\n✅ Job 2 completed: {datetime.now()}")
    
    except Exception as e:
        print(f"\n❌ Job 2 failed: {e}")
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
    .appName("job2-exercise-correlation") \
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

def read_exercise_metrics():
    """Read exercise details from ClickHouse"""
    df = spark.read.jdbc(
        url=CLICKHOUSE_URL,
        table="bigintensive.allenamento_dettagli",
        properties=CLICKHOUSE_PROPS,
    )
    return df.select(
        col("atleta_id").cast("integer").alias("athlete_id"),
        col("ts").cast("date").alias("training_date"),
        col("esercizio_id").cast("integer").alias("exercise_id"),
        col("risultato").cast("double").alias("performance"),
    )

def read_exercises_reference():
    """Read exercise reference data from Citus"""
    df = spark.read.jdbc(
        url=CITUS_URL,
        table="exercises",
        properties=CITUS_PROPS,
    )
    return df.select(
        col("exercise_id"),
        col("nome_esercizio").alias("exercise_name"),
        col("tipo_esercizio").alias("exercise_type"),
    )

######################################################################################################################
###                                                                                                                ###
###                                          DATA PROCESSING AND METRICS CALCULATION                               ###
###                                                                                                                ###
######################################################################################################################

def aggregate_exercise_metrics(df_metrics):
    """
    Aggregate exercise metrics by athlete, exercise, and month.
    Calculate monthly performance trends and variations.
    """
    df_with_month = df_metrics.withColumn(
        "year_month",
        col("training_date").cast("string").substr(1, 7)  # YYYY-MM
    )
    
    # Daily aggregation by exercise
    daily_agg = df_with_month.groupBy(
        "athlete_id", "training_date", "exercise_id", "year_month"
    ).agg(
        max("performance").alias("max_performance"),
        avg("performance").alias("avg_performance"),
        stddev("performance").alias("std_performance"),
    )
    
    # Monthly aggregation by exercise
    monthly_agg = daily_agg.groupBy(
        "athlete_id", "year_month", "exercise_id"
    ).agg(
        avg("max_performance").alias("monthly_max_perf"),
        avg("avg_performance").alias("monthly_avg_perf"),
        count("*").alias("session_count"),
    )
    
    return monthly_agg

def calculate_performance_trends(df_agg):
    """Calculate month-over-month performance variation"""
    
    w = Window.partitionBy("athlete_id", "exercise_id").orderBy("year_month")
    
    df_trends = df_agg \
        .withColumn(
            "prev_monthly_max",
            lag("monthly_max_perf", 1).over(w)
        ) \
        .withColumn(
            "perf_variation",
            when(
                (col("prev_monthly_max").isNull()) | (col("prev_monthly_max") == 0),
                0.0
            ).otherwise(
                ((col("monthly_max_perf") - col("prev_monthly_max")) / col("prev_monthly_max")) * 100
            )
        ) \
        .filter(col("perf_variation").isNotNull())
    
    return df_trends

def calculate_correlation_matrix(df_trends):
    """
    Calculate Pearson correlation matrix between exercises
    to identify which exercises correlate with overall performance.
    """
    
    # Pivot: exercises as columns, performance variations as values
    pivot_df = df_trends.select(
        "athlete_id", "year_month", "exercise_id", "perf_variation"
    ).groupBy(
        "athlete_id", "year_month"
    ).pivot(
        "exercise_id"
    ).agg(
        avg("perf_variation")
    ).fillna(0.0)
    
    # Get feature columns (exercise IDs)
    feature_cols = [c for c in pivot_df.columns if c not in ["athlete_id", "year_month"]]
    
    if len(feature_cols) < 2:
        print("⚠️  Insufficient exercises for correlation matrix")
        return None, feature_cols
    
    # Assemble features
    assembler = VectorAssembler(inputCols=feature_cols, outputCol="features")
    df_features = assembler.transform(pivot_df).select("features")
    
    # Calculate Pearson correlation
    try:
        corr_matrix = Correlation.corr(df_features, "features", "pearson").head()[0]
        return corr_matrix.toArray(), feature_cols
    except Exception as e:
        print(f"⚠️  Error calculating correlation: {e}")
        return None, feature_cols

def train_gradient_boosting_model(df_trends):
    """
    Train Gradient Boosting model to predict performance variation
    and rank exercise features by importance.
    """
    
    # Create feature vector from exercise metrics
    feature_cols = ["monthly_max_perf", "monthly_avg_perf", "std_performance", "session_count"]
    
    # Handle nulls
    for col_name in feature_cols:
        if col_name not in df_trends.columns:
            df_trends = df_trends.withColumn(col_name, lit(0.0))
    
    # Fill nulls with 0
    df_clean = df_trends.select(*feature_cols + ["perf_variation"]).fillna(0.0)
    
    # Remove rows with null target
    df_clean = df_clean.filter(col("perf_variation").isNotNull())
    
    if df_clean.count() < 10:
        print("⚠️  Insufficient data for model training")
        return None
    
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
    
    # Gradient Boosting Regressor
    gbt = GBTRegressor(
        featuresCol="scaled_features",
        labelCol="perf_variation",
        maxIter=20,
        maxDepth=4,
        seed=42
    )
    
    try:
        # Prepare data
        df_assembled = assembler.transform(df_clean)
        scaler_model = scaler.fit(df_assembled)
        df_scaled = scaler_model.transform(df_assembled)
        
        # Train model
        model = gbt.fit(df_scaled)
        
        # Extract feature importance
        importances = model.featureImportances.toArray()
        
        importance_list = []
        for idx, imp in enumerate(importances):
            importance_list.append({
                "feature_name": feature_cols[idx],
                "importance_score": float(imp),
                "ranking": 0  # Will be updated after sorting
            })
        
        # Sort by importance descending
        importance_list.sort(key=lambda x: x["importance_score"], reverse=True)
        for i, item in enumerate(importance_list):
            item["ranking"] = i + 1
        
        return importance_list
    
    except Exception as e:
        print(f"⚠️  Error training model: {e}")
        return None

def write_results_to_citus(importance_list):
    """Write feature importance results to Citus"""
    
    if not importance_list:
        print("❌ No results to write")
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
        
        # Truncate and insert
        cur.execute("TRUNCATE TABLE feature_importance_results")
        
        for item in importance_list:
            cur.execute(
                """INSERT INTO feature_importance_results (feature_name, importance_score, ranking)
                   VALUES (%s, %s, %s)""",
                (item["feature_name"], item["importance_score"], item["ranking"])
            )
        
        conn.commit()
        print(f"✅ Successfully wrote {len(importance_list)} feature importance records to Citus")
    
    except Exception as e:
        print(f"❌ Error writing results: {e}")
        if conn:
            conn.rollback()
    
    finally:
        if conn:
            cur.close()
            conn.close()

def main():
    print("🚀 Job 2: Exercise Correlation & Feature Importance")
    print(f"   Start time: {datetime.now()}")
    print()
    
    try:
        # 1. Read data
        print("📖 Reading exercise metrics from ClickHouse...")
        df_metrics = read_exercise_metrics()
        print(f"   → {df_metrics.count()} metrics read")
        
        # 2. Aggregate metrics
        print("\n⚙️  Aggregating exercise metrics by month...")
        df_agg = aggregate_exercise_metrics(df_metrics)
        print(f"   → {df_agg.count()} monthly aggregates")
        
        # 3. Calculate trends
        print("\n⚙️  Calculating performance trends...")
        df_trends = calculate_performance_trends(df_agg)
        print(f"   → {df_trends.count()} trend records")
        
        # 4. Calculate correlation matrix
        print("\n⚙️  Calculating correlation matrix between exercises...")
        corr_matrix, feature_cols = calculate_correlation_matrix(df_trends)
        if corr_matrix is not None:
            print(f"   → Correlation matrix: {len(feature_cols)} exercises")
        
        # 5. Train Gradient Boosting model
        print("\n⚙️  Training Gradient Boosting model for feature importance...")
        importance_list = train_gradient_boosting_model(df_trends)
        
        if importance_list:
            print("   → Feature Importance Ranking:")
            for item in importance_list:
                print(f"      {item['ranking']}. {item['feature_name']}: {item['importance_score']:.4f}")
        
        # 6. Write results
        print("\n📝 Writing results to Citus...")
        write_results_to_citus(importance_list)
        
        print(f"\n✅ Job 2 completed successfully at {datetime.now()}")
    
    except Exception as e:
        print(f"\n❌ Job 2 failed: {e}")
        raise
    
    finally:
        spark.stop()

if __name__ == "__main__":
    main()

