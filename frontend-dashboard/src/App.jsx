import { useMemo, useState } from "react";
import { mockEvents } from "./mockData";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
const EVENTS_PATH = import.meta.env.VITE_EVENTS_PATH || "/events";

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function App() {
  const [events, setEvents] = useState(mockEvents);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("Nessuna API collegata: visualizzo dati mock locali.");

  // Force plate simulator state
  const [forcePlateConfig, setForcePlateConfig] = useState({
    athlete_id: "athlete-001",
    exercise: "squat",
    duration_ms: 3000,
    repeat: 3,
    interval_s: 2,
  });
  const [forcePlateLoading, setForcePlateLoading] = useState(false);
  const [forcePlateMessage, setForcePlateMessage] = useState("");

  async function refreshEvents() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}${EVENTS_PATH}`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const rows = Array.isArray(data) ? data : data.items;

      if (!Array.isArray(rows)) {
        throw new Error("Formato risposta non valido: atteso array o { items: [] }.");
      }

      setEvents(rows);
    } catch (err) {
      setError(`API non raggiungibile (${err.message}). Mostro i dati mock.`);
      setEvents(mockEvents);
    } finally {
      setLoading(false);
    }
  }

  async function startForcePlate() {
    setForcePlateLoading(true);
    setForcePlateMessage("");

    try {
      const response = await fetch(`${API_BASE}/force-plate/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(forcePlateConfig),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setForcePlateMessage(
        `✓ Simulatore avviato: ${data.athlete_id} / ${data.exercise} (${data.repeat} rep)`,
      );
    } catch (err) {
      setForcePlateMessage(`✗ Errore: ${err.message}`);
    } finally {
      setForcePlateLoading(false);
    }
  }

  const metrics = useMemo(() => {
    const processed = events.filter((e) => e.status === "processed").length;
    const queued = events.filter((e) => e.status === "queued").length;
    const errors = events.filter((e) => e.status === "error").length;
    return {
      total: events.length,
      processed,
      queued,
      errors,
    };
  }, [events]);

  return (
    <div className="page">
      <div className="ambient-shape ambient-shape-a" aria-hidden="true" />
      <div className="ambient-shape ambient-shape-b" aria-hidden="true" />

      <header className="hero">
        <p className="eyebrow">BigIntensive Monitor</p>
        <h1>Data Board</h1>
        <p className="subtitle">
          Dashboard React per monitorare gli eventi Kafka e i dati della pipeline.
        </p>
        <div className="actions">
          <button type="button" onClick={refreshEvents} disabled={loading}>
            {loading ? "Aggiorno..." : "Aggiorna dati"}
          </button>
          <span className="api-target">Endpoint: {`${API_BASE}${EVENTS_PATH}`}</span>
        </div>
      </header>

      {error ? <div className="notice">{error}</div> : null}

      <section className="force-plate-section" aria-label="Simulatore pedana di forza">
        <h2>Pedana di Forza (Dual Foot)</h2>
        <div className="force-plate-form">
          <div className="form-group">
            <label htmlFor="athlete-id">Atleta:</label>
            <input
              id="athlete-id"
              type="text"
              value={forcePlateConfig.athlete_id}
              onChange={(e) =>
                setForcePlateConfig({ ...forcePlateConfig, athlete_id: e.target.value })
              }
            />
          </div>

          <div className="form-group">
            <label htmlFor="exercise">Esercizio:</label>
            <select
              id="exercise"
              value={forcePlateConfig.exercise}
              onChange={(e) =>
                setForcePlateConfig({ ...forcePlateConfig, exercise: e.target.value })
              }
            >
              <option value="squat">Squat</option>
              <option value="jump">Jump</option>
              <option value="leg_press">Leg Press</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="duration">Durata (ms):</label>
            <input
              id="duration"
              type="number"
              value={forcePlateConfig.duration_ms}
              onChange={(e) =>
                setForcePlateConfig({
                  ...forcePlateConfig,
                  duration_ms: parseInt(e.target.value, 10),
                })
              }
            />
          </div>

          <div className="form-group">
            <label htmlFor="repeat">Ripetizioni:</label>
            <input
              id="repeat"
              type="number"
              value={forcePlateConfig.repeat}
              onChange={(e) =>
                setForcePlateConfig({
                  ...forcePlateConfig,
                  repeat: parseInt(e.target.value, 10),
                })
              }
            />
          </div>

          <div className="form-group">
            <label htmlFor="interval">Intervallo (s):</label>
            <input
              id="interval"
              type="number"
              step="0.5"
              value={forcePlateConfig.interval_s}
              onChange={(e) =>
                setForcePlateConfig({
                  ...forcePlateConfig,
                  interval_s: parseFloat(e.target.value),
                })
              }
            />
          </div>

          <button
            type="button"
            onClick={startForcePlate}
            disabled={forcePlateLoading}
            className="btn-primary"
          >
            {forcePlateLoading ? "Avvio..." : "Avvia Simulatore"}
          </button>
        </div>

        {forcePlateMessage && (
          <div
            className={`force-plate-message ${forcePlateMessage.startsWith("✓") ? "success" : "error"}`}
          >
            {forcePlateMessage}
          </div>
        )}
      </section>

      {error ? <div className="notice">{error}</div> : null}

      <section className="stats-grid" aria-label="Metriche eventi">
        <article className="stat-card">
          <h2>Totali</h2>
          <p>{metrics.total}</p>
        </article>
        <article className="stat-card">
          <h2>Processed</h2>
          <p>{metrics.processed}</p>
        </article>
        <article className="stat-card">
          <h2>Queued</h2>
          <p>{metrics.queued}</p>
        </article>
        <article className="stat-card">
          <h2>Error</h2>
          <p>{metrics.errors}</p>
        </article>
      </section>

      <section className="table-wrap" aria-label="Lista eventi">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Topic</th>
              <th>Source</th>
              <th>Status</th>
              <th>Payload</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{event.id}</td>
                <td>{event.topic}</td>
                <td>{event.source}</td>
                <td>
                  <span className={`status status-${event.status || "unknown"}`}>
                    {event.status || "unknown"}
                  </span>
                </td>
                <td>{event.payload}</td>
                <td>{formatDate(event.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
