export default function HandleSimulation() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "";

  const avviaSimulazione = () => {
    fetch(`${apiBaseUrl}/api/v1/startSmartWatchPodSimulator`, { method: "POST" })
      .then((response) => response.json())
      .then((data) => {
        if (!data.success) {
          throw new Error(`Errore nella richiesta: ${data.error}`);
        }
        console.log("Simulazione avviata:", data);
        alert("Simulazione avviata. Controlla la console per i dettagli.");
      })
      .catch((err) => {
        console.error("Errore nell'avvio della simulazione:", err);
        alert(`Errore nell'avvio della simulazione: ${err.message}`);
      });
  };

  const fermaSimulazione = () => {
    fetch(`${apiBaseUrl}/api/v1/stopSmartWatchPodSimulator`, { method: "POST" })
      .then((response) => response.json())
      .then((data) => {
        if (!data.success) {
          throw new Error(`Errore nella richiesta: ${data.error}`);
        }
        console.log("Simulazione fermata:", data);
        alert("Simulazione fermata. Controlla la console per i dettagli.");
      })
      .catch((err) => {
        console.error("Errore nel fermare la simulazione:", err);
        alert(`Errore nel fermare la simulazione: ${err.message}`);
      });
  };

  return (
    <section aria-label="Dati workouts">
      <button onClick={avviaSimulazione}>Avvia simulazione</button>
      <button onClick={fermaSimulazione}>Ferma simulazione</button>
    </section>
  );
}
