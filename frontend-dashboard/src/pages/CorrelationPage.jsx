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
  const [meta, setMeta] = useState({ source: "-", timestamp: null });
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
        setRows(payload.items);
        setMeta({ source: payload.source, timestamp: payload.timestamp });
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
      <p className="panel-subtitle">Confronto tra variabili di training load e indicatori di recupero. Celle verdi indicano associazione positiva, rosse associazione negativa.</p>

      {loading ? <p className="notice">Caricamento dati da backend...</p> : null}
      {error ? <p className="notice">{error}</p> : null}
      {!loading && !error ? (
        <p className="api-target">
          Fonte: {meta.source}
          {meta.timestamp ? ` | Aggiornato: ${new Date(meta.timestamp).toLocaleString()}` : ""}
        </p>
      ) : null}

      {!loading && !error && rows.length === 0 ? <p className="notice">Nessun dato disponibile per la matrice di correlazione.</p> : null}

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
                <td style={{ backgroundColor: getCorrelationTone(row.volume) }}>{Number(row.volume ?? 0).toFixed(2)}</td>
                <td style={{ backgroundColor: getCorrelationTone(row.acwr) }}>{Number(row.acwr ?? 0).toFixed(2)}</td>
                <td style={{ backgroundColor: getCorrelationTone(row.wellness) }}>{Number(row.wellness ?? 0).toFixed(2)}</td>
                <td style={{ backgroundColor: getCorrelationTone(row.readiness) }}>{Number(row.readiness ?? 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
