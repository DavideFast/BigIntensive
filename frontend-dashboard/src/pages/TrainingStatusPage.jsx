import { useMemo } from "react";
import { athletes } from "../data/dashboardData";

export default function TrainingStatusPage() {
  const statusSummary = useMemo(() => {
    const total = athletes.length;
    const green = athletes.filter((item) => item.status === "green").length;
    const amber = athletes.filter((item) => item.status === "amber").length;
    const red = athletes.filter((item) => item.status === "red").length;

    return { total, green, amber, red };
  }, []);

  return (
    <section aria-label="Training status atleti">
      <h2>Training Status</h2>
      <p className="panel-subtitle">
        Snapshot readiness e rischio per atleta, utile per decidere scarico, mantenimento o
        incremento del carico.
      </p>

      <div className="stats-grid">
        <article className="stat-card">
          <h2>Atleti monitorati</h2>
          <p>{statusSummary.total}</p>
        </article>
        <article className="stat-card">
          <h2>Verde</h2>
          <p>{statusSummary.green}</p>
        </article>
        <article className="stat-card">
          <h2>Giallo</h2>
          <p>{statusSummary.amber}</p>
        </article>
        <article className="stat-card">
          <h2>Rosso</h2>
          <p>{statusSummary.red}</p>
        </article>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Atleta</th>
              <th>Status</th>
              <th>ACWR</th>
              <th>Readiness</th>
              <th>Prossima sessione</th>
            </tr>
          </thead>
          <tbody>
            {athletes.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.name}</td>
                <td>
                  <span className={`status status-${item.status}`}>{item.status}</span>
                </td>
                <td>{item.acwr.toFixed(2)}</td>
                <td>{item.readiness}</td>
                <td>{item.nextSession}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
