import { useEffect, useState } from "react";
import { getCorrelationMatrix } from "../api/dashboardApi";

function getCorrelationTone(value) {
  const score = Math.min(1, Math.abs(value));
  if (value >= 0) {
    return `rgba(45, 127, 120, ${0.2 + score * 0.62})`;
  }
  return `rgba(175, 45, 45, ${0.2 + score * 0.62})`;
}

export default function CorrelationPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        const payload = await getCorrelationMatrix();
        if (!isMounted) {
          return;
        }
        setRows(Array.isArray(payload.items) ? payload.items : []);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(`Errore caricamento matrice: ${err.message}`);
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

  return (
    <section aria-label="Dati matrice di correlazione">
      <h2>Matrice di Correlazione</h2>
      <p className="panel-subtitle">
        Confronto tra variabili di training load e indicatori di recupero. Celle verdi indicano
        associazione positiva, rosse associazione negativa.
      </p>

      {loading ? <p className="notice">Caricamento dati da backend...</p> : null}
      {error ? <p className="notice">{error}</p> : null}

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
            {rows.map((row) => (
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
