#!/bin/bash
# Submit Spark Job: Running Population Analysis
# Questo script invia il job al cluster Spark tramite spark-submit

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
JOB_DIR="$SCRIPT_DIR/../spark/jobs"

echo "🚀 Submitting Spark Job: Running Population Analysis"
echo "===================================================="
echo ""

# Configurazione Spark
SPARK_MASTER=${SPARK_MASTER:-"spark://spark-master:7077"}
SPARK_DRIVER_MEMORY=${SPARK_DRIVER_MEMORY:-"2g"}
SPARK_EXECUTOR_MEMORY=${SPARK_EXECUTOR_MEMORY:-"2g"}
SPARK_EXECUTOR_CORES=${SPARK_EXECUTOR_CORES:-"2"}
SPARK_NUM_EXECUTORS=${SPARK_NUM_EXECUTORS:-"4"}

# Database Configuration
CLICKHOUSE_JDBC_URL=${CLICKHOUSE_JDBC_URL:-"jdbc:clickhouse://clickhouse:8123/bigintensive"}
CLICKHOUSE_USER=${CLICKHOUSE_USER:-"default"}
CLICKHOUSE_PASSWORD=${CLICKHOUSE_PASSWORD:-""}

POSTGRES_JDBC_URL=${POSTGRES_JDBC_URL:-"jdbc:postgresql://postgres:5432/bigintensive"}
POSTGRES_USER=${POSTGRES_USER:-"postgres"}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-"postgres"}

KAFKA_BOOTSTRAP_SERVERS=${KAFKA_BOOTSTRAP_SERVERS:-"kafka:19092"}

echo "Configuration:"
echo "  Spark Master: $SPARK_MASTER"
echo "  Driver Memory: $SPARK_DRIVER_MEMORY"
echo "  Executor Memory: $SPARK_EXECUTOR_MEMORY"
echo "  Executors: $SPARK_NUM_EXECUTORS"
echo ""
echo "Job: $JOB_DIR/RunningPopolationAnalysis.py"
echo ""

# Check if spark-submit is available
if ! command -v spark-submit &> /dev/null; then
    echo "❌ spark-submit not found in PATH"
    echo "Make sure Spark is installed and in your PATH"
    exit 1
fi

# Submit the job
spark-submit \
    --master "$SPARK_MASTER" \
    --driver-memory "$SPARK_DRIVER_MEMORY" \
    --executor-memory "$SPARK_EXECUTOR_MEMORY" \
    --executor-cores "$SPARK_EXECUTOR_CORES" \
    --num-executors "$SPARK_NUM_EXECUTORS" \
    --conf "spark.sql.shuffle.partitions=200" \
    --conf "spark.driver.extraClassPath=/usr/local/spark/jars/*" \
    --jars "/usr/local/spark/jars/clickhouse-jdbc-*.jar,/usr/local/spark/jars/postgresql-*.jar" \
    --py-files "$JOB_DIR/config.py" \
    "$JOB_DIR/RunningPopolationAnalysis.py"

echo ""
echo "✅ Job submitted successfully!"
echo ""
echo "View logs:"
echo "  - Spark Web UI: http://spark-master:8080"
echo "  - Application logs: spark-submit output"
