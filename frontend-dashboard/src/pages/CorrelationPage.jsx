import { correlationRows, getCorrelationTone } from "../data/dashboardData";

export default function CorrelationPage() {
  return (
    <section aria-label="Dati matrice di correlazione">
      <h2>Matrice di Correlazione</h2>
      <p className="panel-subtitle">
        Confronto tra variabili di training load e indicatori di recupero. Celle verdi indicano
        associazione positiva, rosse associazione negativa.
      </p>
      <div className="table-wrap correlation-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Variabile</th>
              <th>Volume</th>
              <th>ACWR</th>
              <th>Wellness</th>
              <th>Readiness</th>
            </tr>
          </thead>
          <tbody>
            {correlationRows.map((row) => (
              <tr key={row.metric}>
                <td>{row.metric}</td>
                <td style={{ backgroundColor: getCorrelationTone(row.volume) }}>
                  {row.volume.toFixed(2)}
                </td>
                <td style={{ backgroundColor: getCorrelationTone(row.acwr) }}>
                  {row.acwr.toFixed(2)}
                </td>
                <td style={{ backgroundColor: getCorrelationTone(row.wellness) }}>
                  {row.wellness.toFixed(2)}
                </td>
                <td style={{ backgroundColor: getCorrelationTone(row.readiness) }}>
                  {row.readiness.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
