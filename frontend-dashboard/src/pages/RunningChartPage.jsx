import { useEffect, useMemo, useState } from "react";
import { getRunningChart } from "../api/dashboardApi";

function buildPath(points, key, width, height, padding, minValue, maxValue) {
  if (!points.length) {
    return "";
  }

  const xMax = points[points.length - 1].km || 1;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  return points
    .map((point, index) => {
      const x = padding + (point.km / xMax) * usableWidth;
      const y = padding + (1 - (point[key] - minValue) / Math.max(1, maxValue - minValue)) * usableHeight;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export default function RunningChartPage() {
  const [showDistance, setShowDistance] = useState(true);
  const [showHeartRate, setShowHeartRate] = useState(true);
  const [runningSeries, setRunningSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        const payload = await getRunningChart();
        if (!isMounted) {
          return;
        }
        setRunningSeries(Array.isArray(payload.items) ? payload.items : []);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(`Errore caricamento grafico corsa: ${err.message}`);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const distanceStats = useMemo(() => {
    if (!runningSeries.length) {
      return { min: 0, max: 1, avg: 0 };
    }

    const values = runningSeries.map((point) => point.distanceSplit);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const avg = Math.round((values.reduce((acc, value) => acc + value, 0) / values.length) * 10) / 10;
    return { min, max, avg };
  }, [runningSeries]);

  const heartRateStats = useMemo(() => {
    if (!runningSeries.length) {
      return { min: 0, max: 1, avg: 0 };
    }

    const values = runningSeries.map((point) => point.heartRate);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const avg = Math.round(values.reduce((acc, value) => acc + value, 0) / values.length);
    return { min, max, avg };
  }, [runningSeries]);

  const distancePath = useMemo(
    () => buildPath(runningSeries, "distanceSplit", 940, 360, 30, distanceStats.min, distanceStats.max),
    [distanceStats.max, distanceStats.min, runningSeries],
  );

  const heartRatePath = useMemo(
    () => buildPath(runningSeries, "heartRate", 940, 360, 30, heartRateStats.min, heartRateStats.max),
    [heartRateStats.max, heartRateStats.min, runningSeries],
  );

  return (
    <section aria-label="Grafico corsa con distanza e frequenza cardiaca">
      <h2>Grafico Corsa</h2>
      <p className="panel-subtitle">Visualizzazione sovrapponibile delle curve distanza per split e frequenza cardiaca durante la sessione di corsa.</p>

      {loading ? <p className="notice">Caricamento dati da backend...</p> : null}
      {error ? <p className="notice">{error}</p> : null}

      <div className="run-toggle-row" role="group" aria-label="Serie da visualizzare">
        <label className="run-toggle">
          <input type="checkbox" checked={showDistance} onChange={(event) => setShowDistance(event.target.checked)} />
          Distanza split
        </label>
        <label className="run-toggle">
          <input type="checkbox" checked={showHeartRate} onChange={(event) => setShowHeartRate(event.target.checked)} />
          Frequenza cardiaca
        </label>
      </div>

      <div className="run-chart-shell" role="img" aria-label="Grafico lineare distanza e frequenza cardiaca">
        <svg viewBox="0 0 940 360" className="run-chart-svg" preserveAspectRatio="none">
          <rect x="0" y="0" width="940" height="360" rx="14" ry="14" fill="rgba(255,255,255,0.7)" />
          <line x1="30" y1="330" x2="910" y2="330" className="run-axis" />
          <line x1="30" y1="30" x2="30" y2="330" className="run-axis" />

          {showDistance ? <path d={distancePath} fill="none" className="run-line-distance" /> : null}
          {showHeartRate ? <path d={heartRatePath} fill="none" className="run-line-heart" /> : null}
        </svg>
      </div>

      <div className="chart-summary run-summary-grid">
        <article className="summary-card">
          <h3>Distanza split media</h3>
          <p>{distanceStats.avg} km</p>
        </article>
        <article className="summary-card">
          <h3>FC media</h3>
          <p>{heartRateStats.avg} bpm</p>
        </article>
        <article className="summary-card">
          <h3>Picco FC</h3>
          <p>{heartRateStats.max} bpm</p>
        </article>
      </div>
    </section>
  );
}
