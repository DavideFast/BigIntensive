import { Kafka } from "kafkajs";

export function createKafkaProducerFromEnv() {
  const brokersRaw = process.env.KAFKA_BOOTSTRAP_SERVERS || "localhost:9094";
  const brokers = brokersRaw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const clientId = process.env.KAFKA_CLIENT_ID || "bigintensive-backend";

  const kafka = new Kafka({
    clientId,
    brokers,
  });

  const producer = kafka.producer();
  let connected = false;

  async function ensureConnected() {
    if (!connected) {
      await producer.connect();
      connected = true;
    }
  }

  return {
    async sendJsonBatch({ topic, events }) {
      if (!topic) {
        throw new Error("Missing Kafka topic");
      }

      const messages = (events || []).map((event) => ({
        value: JSON.stringify(event),
      }));

      if (messages.length === 0) {
        return { sentCount: 0 };
      }

      await ensureConnected();
      await producer.send({
        topic,
        messages,
      });

      return { sentCount: messages.length };
    },

    async disconnect() {
      if (connected) {
        await producer.disconnect();
        connected = false;
      }
    },

    getMeta() {
      return {
        brokers,
        clientId,
      };
    },
  };
}
