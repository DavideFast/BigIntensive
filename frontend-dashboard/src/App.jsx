import { useMemo, useState } from "react";
import { mockEvents } from "./mockData";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
const EVENTS_PATH = import.meta.env.VITE_EVENTS_PATH || "/events";

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function createForceSeries(config) {
  const points = 120;
  const duration = Math.max(500, Number(config.duration_ms) || 3000);
  const repeat = Math.max(1, Number(config.repeat) || 1);
  const interval = Math.max(0.2, Number(config.interval_s) || 1);
  const amplitude = config.exercise === "jump" ? 1150 : config.exercise === "leg_press" ? 980 : 840;

  return Array.from({ length: points }, (_, index) => {
    const t = (duration / 1000) * (index / (points - 1));
    const wave = Math.sin((index / (points - 1)) * Math.PI * repeat * 1.9 + interval * 0.45);
    const noise = (Math.cos(index * 0.43) + Math.sin(index * 0.19)) * 22;
    const force = Math.max(90, amplitude + wave * 170 + noise);
    return {
      t,
      force: Math.round(force),
    };
  });
}

function getChartPath(points, width, height, padding) {
  if (!points.length) {
    return "";
  }

  const xMax = points[points.length - 1].t || 1;
  const yMin = Math.min(...points.map((p) => p.force));
  const yMax = Math.max(...points.map((p) => p.force));
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  return points
    .map((point, index) => {
      const x = padding + (point.t / xMax) * usableWidth;
      const y = padding + (1 - (point.force - yMin) / Math.max(1, yMax - yMin)) * usableHeight;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export default function App() {
  const [activePage, setActivePage] = useState("generator");
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
  const [chartData, setChartData] = useState(() =>
    createForceSeries({
      athlete_id: "athlete-001",
      exercise: "squat",
      duration_ms: 3000,
      repeat: 3,
      interval_s: 2,
    }),
  );

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
      setForcePlateMessage(`✓ Simulatore avviato: ${data.athlete_id} / ${data.exercise} (${data.repeat} rep)`);
    } catch (err) {
      setForcePlateMessage(`✗ Errore: ${err.message}`);
    } finally {
      setForcePlateLoading(false);
    }
  }

  function generateChart() {
    setChartData(createForceSeries(forcePlateConfig));
    setForcePlateMessage("✓ Grafico rigenerato con i parametri correnti.");
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

  const chartSummary = useMemo(() => {
    if (!chartData.length) {
      return { min: 0, max: 0, avg: 0 };
    }

    const values = chartData.map((p) => p.force);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = Math.round(values.reduce((acc, value) => acc + value, 0) / values.length);
    return { min, max, avg };
  }, [chartData]);

  const chartPath = useMemo(() => getChartPath(chartData, 920, 340, 28), [chartData]);

  return (
    <div className="page">
      <div className="ambient-shape ambient-shape-a" aria-hidden="true" />
      <div className="ambient-shape ambient-shape-b" aria-hidden="true" />

      <header className="hero">
        <p className="eyebrow">BigIntensive Monitor</p>
        <h1>Data Board</h1>
        <p className="subtitle">Dashboard React per gestire simulazione e risultati della pipeline in due viste distinte.</p>
        <div className="page-tabs" role="tablist" aria-label="Navigazione dashboard">
          <button type="button" className={`tab-btn ${activePage === "generator" ? "active" : ""}`} onClick={() => setActivePage("generator")} aria-pressed={activePage === "generator"}>
            Generazione Grafico
          </button>
          <button type="button" className={`tab-btn ${activePage === "results" ? "active" : ""}`} onClick={() => setActivePage("results")} aria-pressed={activePage === "results"}>
            Risultati
          </button>
        </div>
        <div className="actions">
          <span className="api-target">Endpoint: {`${API_BASE}${EVENTS_PATH}`}</span>
        </div>
      </header>

      {activePage === "generator" ? (
        <>
          <section className="force-plate-section" aria-label="Generazione grafico pedana di forza">
            <h2>Generazione Grafico</h2>
            <p className="panel-subtitle">Configura i parametri della sessione, avvia la simulazione e rigenera il tracciato forza/tempo.</p>

            <div className="force-plate-form">
              <div className="form-group">
                <label htmlFor="athlete-id">Atleta:</label>
                <input id="athlete-id" type="text" value={forcePlateConfig.athlete_id} onChange={(e) => setForcePlateConfig({ ...forcePlateConfig, athlete_id: e.target.value })} />
              </div>

              <div className="form-group">
                <label htmlFor="exercise">Esercizio:</label>
                <select id="exercise" value={forcePlateConfig.exercise} onChange={(e) => setForcePlateConfig({ ...forcePlateConfig, exercise: e.target.value })}>
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

              <div className="form-actions">
                <button type="button" onClick={startForcePlate} disabled={forcePlateLoading} className="btn-primary">
                  {forcePlateLoading ? "Avvio..." : "Avvia Simulatore"}
                </button>
                <button type="button" onClick={generateChart} className="btn-secondary">
                  Rigenera Grafico
                </button>
              </div>
            </div>

            {forcePlateMessage && <div className={`force-plate-message ${forcePlateMessage.startsWith("✓") ? "success" : "error"}`}>{forcePlateMessage}</div>}

            <div className="chart-shell" role="img" aria-label="Grafico forza nel tempo">
              <svg viewBox="0 0 920 340" className="chart-svg" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="forceLine" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#d0642a" />
                    <stop offset="100%" stopColor="#2d7f78" />
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width="920" height="340" rx="14" ry="14" fill="rgba(255,255,255,0.65)" />
                <path d={chartPath} fill="none" stroke="url(#forceLine)" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </div>

            <div className="chart-summary">
              <article className="summary-card">
                <h3>Picco</h3>
                <p>{chartSummary.max} N</p>
              </article>
              <article className="summary-card">
                <h3>Minimo</h3>
                <p>{chartSummary.min} N</p>
              </article>
              <article className="summary-card">
                <h3>Media</h3>
                <p>{chartSummary.avg} N</p>
              </article>
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="actions top-results-actions">
            <button type="button" onClick={refreshEvents} disabled={loading}>
              {loading ? "Aggiorno..." : "Aggiorna dati"}
            </button>
          </div>

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
                      <span className={`status status-${event.status || "unknown"}`}>{event.status || "unknown"}</span>
                    </td>
                    <td>{event.payload}</td>
                    <td>{formatDate(event.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
