export default function CorrelationPage() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const url = "/api/v1/readClickhouse";
    fetch(url)
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        if (!data.success) {
          throw new Error(`Errore nella richiesta: ${data.error}`);
        }
        return data;
      })
      .then((data) => {
        setRows(data.data || []);
      })
      .catch((err) => {
        console.error("Errore nel fetch dei dati della corsa:", err);
      });
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
