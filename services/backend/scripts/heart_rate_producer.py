#!/usr/bin/env python3
"""Produce simulated endurance-run heart-rate data to Kafka."""

import argparse
import json
import time
from datetime import datetime

from kafka import KafkaProducer

from BigIntensive.test.heart_rate_simulator import HeartRateSimulator
from BigIntensive.test.kafka_common import kafka_bootstrap_servers


def send_heart_rate_data(
    producer: KafkaProducer,
    topic: str,
    athlete_id: str,
    duration_ms: int,
    repeat: int,
    interval_s: float,
    session_id: int | None,
) -> None:
    for session in range(repeat):
        print(f"\n=== Session {session + 1}/{repeat} ===")
        current_session_id = session_id or int(datetime.utcnow().timestamp()) + session

        simulator = HeartRateSimulator(athlete_id=athlete_id, duration_ms=duration_ms)
        samples = simulator.generate_samples(sample_rate_hz=1)

        for sample in samples:
            sample["session_id"] = current_session_id
            producer.send(topic, value=json.dumps(sample).encode("utf-8"))
            time.sleep(1.0)

        print(f"Sent {len(samples)} heart-rate samples")

        if session < repeat - 1:
            print(f"Waiting {interval_s}s before next session...")
            time.sleep(interval_s)

    producer.flush()
    print(f"\nFinished sending heart-rate data for athlete {athlete_id}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Stream endurance heart-rate data to Kafka")
    parser.add_argument("--athlete-id", default="athlete-001", help="Athlete identifier")
    parser.add_argument("--duration-ms", type=int, default=30_000, help="Session duration")
    parser.add_argument("--repeat", type=int, default=1, help="Number of sessions")
    parser.add_argument("--interval-s", type=float, default=10.0, help="Pause between sessions")
    parser.add_argument("--topic", default="heart-rate-events", help="Kafka topic name")
    parser.add_argument("--session-id", type=int, default=None, help="Session identifier")
    return parser


def main() -> None:
    args = build_parser().parse_args()

    producer = KafkaProducer(
        bootstrap_servers=kafka_bootstrap_servers(),
        value_serializer=lambda v: v,
    )

    send_heart_rate_data(
        producer=producer,
        topic=args.topic,
        athlete_id=args.athlete_id,
        duration_ms=args.duration_ms,
        repeat=args.repeat,
        interval_s=args.interval_s,
        session_id=args.session_id,
    )


if __name__ == "__main__":
    main()
