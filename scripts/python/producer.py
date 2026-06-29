import argparse
import json
from kafka import KafkaProducer

from kafka_common import kafka_bootstrap_servers, kafka_default_topic


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Kafka producer for app integration")
    parser.add_argument("--topic", default=kafka_default_topic(), help="Kafka topic name")
    parser.add_argument("--key", default=None, help="Optional message key")
    parser.add_argument("--message", required=True, help="Message payload")
    parser.add_argument(
        "--as-json",
        action="store_true",
        help="Wrap message into a JSON envelope",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()

    producer = KafkaProducer(
        bootstrap_servers=kafka_bootstrap_servers(),
        value_serializer=lambda v: v.encode("utf-8"),
        key_serializer=(lambda v: v.encode("utf-8")) if args.key else None,
    )

    payload = args.message
    if args.as_json:
        payload = json.dumps({"event": args.message})

    future = producer.send(args.topic, key=args.key, value=payload)
    metadata = future.get(timeout=10)
    producer.flush()
    producer.close()

    print(
        f"Sent message to topic={metadata.topic} partition={metadata.partition} offset={metadata.offset}"
    )


if __name__ == "__main__":
    main()
