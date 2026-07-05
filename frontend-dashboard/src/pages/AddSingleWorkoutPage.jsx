import { useState } from "react";
import { starterWorkout } from "../data/dashboardData";

export default function AddSingleWorkoutPage() {
  const [singleForm, setSingleForm] = useState(starterWorkout);
  const [singleMessage, setSingleMessage] = useState("");

  function handleSubmitSingle(event) {
    event.preventDefault();
    setSingleMessage(
      `Allenamento simulato per ${singleForm.athlete}: ${singleForm.sessionType}, ${singleForm.duration} min, RPE ${singleForm.intensity}.`,
    );
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
          <select
            id="single-athlete"
            value={singleForm.athlete}
            onChange={(event) => setSingleForm({ ...singleForm, athlete: event.target.value })}
          >
            <option value="AT-001">AT-001</option>
            <option value="AT-002">AT-002</option>
            <option value="AT-003">AT-003</option>
            <option value="AT-004">AT-004</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="single-type">Tipo sessione</label>
          <select
            id="single-type"
            value={singleForm.sessionType}
            onChange={(event) => setSingleForm({ ...singleForm, sessionType: event.target.value })}
          >
            <option value="Forza">Forza</option>
            <option value="Tecnica">Tecnica</option>
            <option value="Recupero">Recupero</option>
          </select>
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
          <button type="submit" className="btn-primary">
            Simula inserimento
          </button>
        </div>
      </form>
      {singleMessage ? <p className="notice simulation-notice">{singleMessage}</p> : null}
    </section>
  );
}
