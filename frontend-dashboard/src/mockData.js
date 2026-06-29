export const mockEvents = [
  {
    id: "evt-001",
    topic: "demo-events",
    source: "producer.py",
    status: "processed",
    payload: "utente_registrato",
    createdAt: "2026-06-29T16:20:00Z",
  },
  {
    id: "evt-002",
    topic: "demo-events",
    source: "spark-stream",
    status: "queued",
    payload: "nuovo_workout",
    createdAt: "2026-06-29T16:23:00Z",
  },
  {
    id: "evt-003",
    topic: "billing-events",
    source: "backend-api",
    status: "error",
    payload: "fattura_non_valida",
    createdAt: "2026-06-29T16:27:00Z",
  },
];
