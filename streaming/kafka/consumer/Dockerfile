# Stage 1: Build
FROM maven:3.9.5-eclipse-temurin-17 AS builder
WORKDIR /build
COPY kafka-consumer-real-time/ .
RUN mvn clean package -DskipTests

# Stage 2: Runtime
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Copy the built JAR
COPY --from=builder /build/target/kafka-consumer-real-time-1.0-SNAPSHOT-jar-with-dependencies.jar /app/kafka-consumer.jar

# Create state store directory
RUN apk add --no-cache libstdc++ libc6-compat
RUN mkdir -p /var/lib/kafka-streams && chmod 777 /var/lib/kafka-streams

# Variabili di ambiente per le connessioni
ENV KAFKA_BOOTSTRAP_SERVERS=kafka:19092
ENV CLICKHOUSE_URL=jdbc:clickhouse://clickhouse:8123/bigintensive
ENV CLICKHOUSE_USER=default
ENV CLICKHOUSE_PASSWORD=

ENV POSTGRES_URL=jdbc:postgresql://postgres:5432/bigintensive
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=postgres

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD java -version || exit 1

ENTRYPOINT ["java", "-Xms256m", "-Xmx512m", "-jar", "/app/kafka-consumer.jar"]

