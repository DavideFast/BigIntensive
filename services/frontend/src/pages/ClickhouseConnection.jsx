import React, { useEffect, useState } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, scales } from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const options = {
  responsive: true,
  plugins: {
    legend: {
      position: "top",
    },
    title: {
      display: true,
      text: "Sessione di corsa",
    },
  },
  scales: {
    x: {
      type: "category",
    },
    y: {
      type: "linear",
    },
  },
};

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
    <section aria-label="Dati corsa">
      <h2>Sessione di corsa</h2>
      <p className="panel-subtitle">Sessione corsa ottenuta prelevando i dati da clickhouse</p>
      <div className="table-wrap correlation-table-wrap"></div>
    </section>
  );
}
