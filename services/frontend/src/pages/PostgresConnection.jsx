export default function PostgresConnectionPage() {
  const [rows, setRows] = useState([]);

  useEffect(() => {}, []);

  return (
    <section aria-label="Dati matrice di correlazione">
      <h2>Esempio di allenamento</h2>
      <p className="panel-subtitle">Confronto tra variabili di training load e indicatori di recupero. Celle verdi indicano associazione positiva, rosse associazione negativa.</p>

      <div className="table-wrap correlation-table-wrap"></div>
    </section>
  );
}
