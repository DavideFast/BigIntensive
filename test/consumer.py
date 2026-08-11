import argparse
from kafka import KafkaConsumer

from kafka_common import kafka_bootstrap_servers, kafka_default_topic


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Kafka consumer for app integration")
    parser.add_argument("--topic", default=kafka_default_topic(), help="Kafka topic name")
    parser.add_argument(
        "--group-id",
        default="bigintensive-app",
        help="Consumer group id",
    )
    parser.add_argument(
        "--from-beginning",
        action="store_true",
        help="Read from earliest offset",
    )
    parser.add_argument(
        "--max-messages",
        type=int,
        default=0,
        help="Stop after N messages (0 means run forever)",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()

    consumer = KafkaConsumer(
        args.topic,
        bootstrap_servers=kafka_bootstrap_servers(),
        group_id=args.group_id,
        auto_offset_reset="earliest" if args.from_beginning else "latest",
        enable_auto_commit=True,
        value_deserializer=lambda v: v.decode("utf-8", errors="replace"),
        key_deserializer=lambda v: v.decode("utf-8", errors="replace") if v else None,
    )

    print(
        f"Listening topic={args.topic} group_id={args.group_id} servers={','.join(kafka_bootstrap_servers())}"
    )

    received = 0
    try:
        for message in consumer:
            print(
                f"offset={message.offset} partition={message.partition} key={message.key} value={message.value}"
            )
            received += 1
            if args.max_messages > 0 and received >= args.max_messages:
                break
    finally:
        consumer.close()


if __name__ == "__main__":
    main()
