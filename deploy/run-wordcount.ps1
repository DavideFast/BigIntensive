docker compose up -d

docker compose exec spark-master spark-submit --master spark://spark-master:7077 /opt/spark-apps/wordcount.py
