import { useMemo } from "react";
import { weeklyVolumes } from "../data/dashboardData";

export default function VolumePage() {
  const weeklyStats = useMemo(() => {
    const total = weeklyVolumes.reduce((acc, day) => acc + day.load, 0);
    const avg = Math.round(total / weeklyVolumes.length);
    const max = Math.max(...weeklyVolumes.map((day) => day.load));
    const min = Math.min(...weeklyVolumes.map((day) => day.load));
    return { total, avg, max, min };
  }, []);

  return (
    <section aria-label="Volumi allenamento settimanali">
      <h2>Volumi Allenamento</h2>
      <p className="panel-subtitle">
        Distribuzione del carico interno settimanale per evitare picchi improvvisi e migliorare
        continuita del piano.
      </p>

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
