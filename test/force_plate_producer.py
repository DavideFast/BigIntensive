#!/usr/bin/env python3
"""
Produces force plate sensor data (dual foot measurements) to Kafka
"""

import argparse
import json
import time
from kafka import KafkaProducer
from kafka_common import kafka_bootstrap_servers, kafka_default_topic
from force_plate_simulator import ForceProfileSimulator


def send_force_data(producer, topic, athlete_id, exercise, duration_ms, repeat, interval_s):
    """Send force plate data to Kafka"""
    for rep in range(repeat):
        print(f"\n=== Repetition {rep + 1}/{repeat} ===")

        simulator = ForceProfileSimulator(athlete_id, exercise, duration_ms)
        samples = simulator.generate_samples(sample_rate_hz=100)

        for sample in samples:
            producer.send(topic, value=json.dumps(sample).encode("utf-8"))
            # Simulate real-time streaming with sampling interval
            time.sleep(0.01)  # 10ms between samples = ~100Hz

        print(f"Sent {len(samples)} samples")

        if rep < repeat - 1:
            print(f"Waiting {interval_s}s before next rep...")
            time.sleep(interval_s)

    producer.flush()
    print(f"\nFinished sending force plate data for {athlete_id} / {exercise}")


def main():
    parser = argparse.ArgumentParser(description="Stream force plate data to Kafka")
    parser.add_argument(
        "--athlete-id",
        type=str,
        default="athlete-001",
        help="Athlete identifier",
    )
    parser.add_argument(
        "--exercise",
        type=str,
        choices=["squat", "jump", "leg_press"],
        default="squat",
        help="Exercise type",
    )
    parser.add_argument(
        "--duration-ms",
        type=int,
        default=3000,
        help="Exercise duration in milliseconds",
    )
    parser.add_argument(
        "--repeat",
        type=int,
        default=1,
        help="Number of repetitions",
    )
    parser.add_argument(
        "--interval-s",
        type=float,
        default=2,
        help="Interval between reps in seconds",
    )
    parser.add_argument(
        "--topic",
        type=str,
        default=None,
        help="Kafka topic (default from KAFKA_TOPIC env var)",
    )

    args = parser.parse_args()
    topic = args.topic or kafka_default_topic()

    try:
        brokers = kafka_bootstrap_servers()
        print(f"Connecting to Kafka: {brokers}")
        producer = KafkaProducer(
            bootstrap_servers=brokers,
            value_serializer=lambda v: v,
        )

        send_force_data(
            producer,
            topic,
            args.athlete_id,
            args.exercise,
            args.duration_ms,
            args.repeat,
            args.interval_s,
        )

    except Exception as e:
        print(f"Error: {e}")
        exit(1)


if __name__ == "__main__":
    main()
