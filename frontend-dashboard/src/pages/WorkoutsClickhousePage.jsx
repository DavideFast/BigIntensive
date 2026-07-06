import { useEffect, useMemo, useState } from "react";
import { getWorkoutsClickhouseChart } from "../api/dashboardApi";

export default function WorkoutsClickhousePage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ source: "-", timestamp: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const payload = await getWorkoutsClickhouseChart();
        if (!isMounted) {
          return;
        }

        setItems(payload.items || []);
        setMeta({ source: payload.source, timestamp: payload.timestamp });
      } catch (err) {
        if (!isMounted) {
          return;
        }

        setError(`Errore caricamento visualizzatore ClickHouse: ${err.message}`);
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

  const stats = useMemo(() => {
    if (!items.length) {
      return { totalInserts: 0, avgIntensity: 0, totalLoad: 0, peakInserts: 0 };
    }

    const totalInserts = items.reduce((acc, item) => acc + Number(item.inserts || 0), 0);
    const weightedIntensity = items.reduce((acc, item) => {
      const inserts = Number(item.inserts || 0);
      const intensity = Number(item.avgIntensity || 0);
      return acc + inserts * intensity;
    }, 0);
    const totalLoad = items.reduce((acc, item) => acc + Number(item.totalTargetLoad || 0), 0);
    const peakInserts = Math.max(...items.map((item) => Number(item.inserts || 0)));

    return {
      totalInserts,
      avgIntensity: totalInserts > 0 ? Math.round((weightedIntensity / totalInserts) * 10) / 10 : 0,
      totalLoad,
      peakInserts,
    };
  }, [items]);

  return (
    <section aria-label="Visualizzatore allenamenti da ClickHouse">
      <h2>Visualizzatore Allenamenti ClickHouse</h2>
      <p className="panel-subtitle">
        Grafico giornaliero degli inserimenti allenamento letti direttamente da ClickHouse.
      </p>

      {loading ? <p className="notice">Caricamento dati ClickHouse...</p> : null}
      {error ? <p className="notice">{error}</p> : null}
      {!loading && !error ? (
        <p className="api-target">
          Fonte: {meta.source}
          {meta.timestamp ? ` | Aggiornato: ${new Date(meta.timestamp).toLocaleString()}` : ""}
        </p>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <p className="notice">Nessun dato allenamenti disponibile in ClickHouse.</p>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="volume-bars">
          {items.map((item) => {
            const heightPct = stats.peakInserts > 0
              ? Math.max(6, Math.round((Number(item.inserts || 0) / stats.peakInserts) * 100))
              : 6;

            return (
              <article className="bar-card" key={item.day}>
                <p>{item.day}</p>
                <div className="bar-shell">
                  <div className="bar-fill" style={{ height: `${heightPct}%` }} />
                </div>
                <strong>{item.inserts} insert</strong>
                <p>Intensita media: {item.avgIntensity}</p>
              </article>
            );
          })}
        </div>
      ) : null}

      <div className="chart-summary run-summary-grid">
        <article className="summary-card">
          <h3>Inserimenti totali</h3>
          <p>{stats.totalInserts}</p>
        </article>
        <article className="summary-card">
          <h3>Intensita media</h3>
          <p>{stats.avgIntensity}</p>
        </article>
        <article className="summary-card">
          <h3>Carico totale</h3>
          <p>{stats.totalLoad}</p>
        </article>
      </div>
    </section>
  );
}
