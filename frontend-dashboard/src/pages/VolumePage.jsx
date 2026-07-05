import { useEffect, useMemo, useState } from "react";
import { getTrainingVolumes } from "../api/dashboardApi";

export default function VolumePage() {
  const [weeklyVolumes, setWeeklyVolumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        const payload = await getTrainingVolumes();
        if (!isMounted) {
          return;
        }
        setWeeklyVolumes(Array.isArray(payload.items) ? payload.items : []);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(`Errore caricamento volumi: ${err.message}`);
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

  const weeklyStats = useMemo(() => {
    if (!weeklyVolumes.length) {
      return { total: 0, avg: 0, max: 1, min: 0 };
    }

    const total = weeklyVolumes.reduce((acc, day) => acc + day.load, 0);
    const avg = Math.round(total / weeklyVolumes.length);
    const max = Math.max(...weeklyVolumes.map((day) => day.load));
    const min = Math.min(...weeklyVolumes.map((day) => day.load));
    return { total, avg, max, min };
  }, [weeklyVolumes]);

  return (
    <section aria-label="Volumi allenamento settimanali">
      <h2>Volumi Allenamento</h2>
      <p className="panel-subtitle">
        Distribuzione del carico interno settimanale per evitare picchi improvvisi e migliorare
        continuita del piano.
      </p>

      {loading ? <p className="notice">Caricamento dati da backend...</p> : null}
      {error ? <p className="notice">{error}</p> : null}

      <div className="volume-bars" role="img" aria-label="Grafico a barre dei volumi giornalieri">
        {weeklyVolumes.map((day) => (
          <article key={day.day} className="bar-card">
            <p>{day.day}</p>
            <div className="bar-shell">
              <div
                className="bar-fill"
                style={{ height: `${Math.round((day.load / weeklyStats.max) * 100)}%` }}
              />
            </div>
            <strong>{day.load}</strong>
          </article>
        ))}
      </div>

      <div className="chart-summary">
        <article className="summary-card">
          <h3>Volume Totale</h3>
          <p>{weeklyStats.total}</p>
        </article>
        <article className="summary-card">
          <h3>Media Giornaliera</h3>
          <p>{weeklyStats.avg}</p>
        </article>
        <article className="summary-card">
          <h3>Range</h3>
          <p>
            {weeklyStats.min} - {weeklyStats.max}
          </p>
        </article>
      </div>
    </section>
  );
}
