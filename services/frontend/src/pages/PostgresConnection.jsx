import { useEffect, useState } from "react";

export default function PostgresConnectionPage() {
  const [rows, setRows] = useState([]);
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    const url = "/api/v1/readPostgresql";
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
        console.log("Dati letti da PostgreSQL:", data);
        console.log("Dati letti da PostgreSQL:", data.data);
        console.log("Dati letti da PostgreSQL:", data.data[0].struttura_allenamento.esercizi);
        const arrayData = data.length > 0 ? data.data : [];
        for (let i = 0; i < arrayData.length; i++)
          arrayData[i] = data.data[i].struttura_allenamento.esercizi.map((row) => {
            return {
              struttura: row.nome + " " + row.serie + "x" + row.ripetizioni ? row.ripetizioni : row.durata_secondi + " rec. " + row.recupero_secondi + "s",
            };
          });
        setRows(arrayData || []);
      })
      .catch((err) => {
        console.error("Errore nel fetch dei dati degli allenamenti:", err);
      });
  }, []);

  return (
    <section aria-label="Dati workouts">
      <h2>Esempio di allenamento</h2>
      <p className="panel-subtitle">Allenamento recente</p>
      <div className="table-wrap workouts-wrap">
        <Select
          value={indice}
          onChange={(e) => {
            const selectedIndex = parseInt(e.target.value, 10);
            if (!isNaN(selectedIndex)) {
              setIndice(selectedIndex);
            }
          }}
        >
          {rows.map((row, index) => (
            <MenuItem key={index} value={index}>
              {row.struttura}
            </MenuItem>
          ))}
        </Select>
        {rows[indice] ? (
          <table className="table workouts-table">
            <thead>
              <tr>
                <th>Struttura allenamento</th>
              </tr>
            </thead>
            <tbody>
              {rows[indice].map((row, index) => (
                <tr key={index}>
                  <td>{row.struttura}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Nessun allenamento disponibile.</p>
        )}
      </div>
      <button
        onClick={() => {
          fetch("/api/v1/writePostgresql")
            .then((response) => response.json())
            .then((data) => {
              if (!data.success) {
                throw new Error(`Errore nella richiesta: ${data.error}`);
              }
              return data;
            })
            .then((data) => {
              console.log("Dati scritti nel database PostgreSQL:", data);
              alert("Dati scritti nel database PostgreSQL. Controlla la console per i dettagli.");
            })
            .catch((err) => {
              console.error("Errore nel fetch dei dati degli allenamenti:", err);
              alert(`Errore nel fetch dei dati degli allenamenti: ${err.message}`);
            });
        }}
      >
        Scrivi Allenamento di esempio
      </button>
    </section>
  );
}
