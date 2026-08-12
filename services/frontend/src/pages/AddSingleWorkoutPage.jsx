import { useState } from "react";
import { simulateWorkout } from "../api/dashboardApi";

export default function AddSingleWorkoutPage() {
  const [singleForm, setSingleForm] = useState({
    athlete: "AT-001",
    sessionType: "Forza",
    duration: 65,
    intensity: 7,
    notes: "",
    destination: "citus",
  });
  const [singleMessage, setSingleMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmitSingle(event) {
    event.preventDefault();

    try {
      setSubmitting(true);
      const response = await simulateWorkout(singleForm);
      const payload = response.payload || {};
      setSingleMessage(
        `Backend: ${payload.athlete || singleForm.athlete}, ${payload.sessionType || singleForm.sessionType}, ${payload.duration || singleForm.duration} min, RPE ${payload.intensity || singleForm.intensity}. Destinazione: ${response.destination || singleForm.destination}.`,
      );
    } catch (err) {
      setSingleMessage(`Errore simulazione backend: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-label="Simulazione aggiunta allenamento singolo">
      <h2>Simula Aggiunta Allenamento</h2>
      <p className="panel-subtitle">
        Compila il form per simulare il salvataggio di una singola sessione nel planning quotidiano.
      </p>
      <form className="force-plate-form" onSubmit={handleSubmitSingle}>
        <div className="form-group">
          <label htmlFor="single-athlete">Atleta</label>
          <input
            id="single-athlete"
            type="text"
            value={singleForm.athlete}
            onChange={(event) => setSingleForm({ ...singleForm, athlete: event.target.value })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="single-type">Tipo sessione</label>
          <input
            id="single-type"
            type="text"
            value={singleForm.sessionType}
            onChange={(event) => setSingleForm({ ...singleForm, sessionType: event.target.value })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="single-duration">Durata (min)</label>
          <input
            id="single-duration"
            type="number"
            min="20"
            max="180"
            value={singleForm.duration}
            onChange={(event) =>
              setSingleForm({ ...singleForm, duration: Number(event.target.value) })
            }
          />
        </div>

        <div className="form-group">
          <label htmlFor="single-intensity">Intensita percepita (1-10)</label>
          <input
            id="single-intensity"
            type="number"
            min="1"
            max="10"
            value={singleForm.intensity}
            onChange={(event) =>
              setSingleForm({ ...singleForm, intensity: Number(event.target.value) })
            }
          />
        </div>

        <div className="form-group">
          <label htmlFor="single-destination">Destinazione database</label>
          <select
            id="single-destination"
            value={singleForm.destination}
            onChange={(event) => setSingleForm({ ...singleForm, destination: event.target.value })}
          >
            <option value="citus">Citus</option>
            <option value="clickhouse">ClickHouse</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="single-notes">Note</label>
          <input
            id="single-notes"
            type="text"
            value={singleForm.notes}
            onChange={(event) => setSingleForm({ ...singleForm, notes: event.target.value })}
            placeholder="es. focus tecnico"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Invio..." : "Simula inserimento"}
          </button>
        </div>
      </form>
      {singleMessage ? <p className="notice simulation-notice">{singleMessage}</p> : null}
    </section>
  );
}
