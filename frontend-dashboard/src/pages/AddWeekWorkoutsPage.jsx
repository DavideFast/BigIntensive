import { useState } from "react";
import { starterWeek } from "../data/dashboardData";

export default function AddWeekWorkoutsPage() {
  const [weekForm, setWeekForm] = useState(starterWeek);
  const [weekMessage, setWeekMessage] = useState("");

  function handleSubmitWeek(event) {
    event.preventDefault();
    const perDay = Math.round(Number(weekForm.targetLoad) / 7);
    setWeekMessage(
      `Microciclo creato per ${weekForm.athlete}: fase ${weekForm.phase}, focus ${weekForm.focus}, carico medio giornaliero ${perDay}.`,
    );
  }

  return (
    <section aria-label="Simulazione pianificazione allenamenti settimanali">
      <h2>Simula Aggiunta Allenamenti Settimanali</h2>
      <p className="panel-subtitle">
        Seconda schermata di inserimento: crea un microciclo completo e verifica il carico target
        distribuito.
      </p>
      <form className="force-plate-form" onSubmit={handleSubmitWeek}>
        <div className="form-group">
          <label htmlFor="week-athlete">Atleta</label>
          <select
            id="week-athlete"
            value={weekForm.athlete}
            onChange={(event) => setWeekForm({ ...weekForm, athlete: event.target.value })}
          >
            <option value="AT-001">AT-001</option>
            <option value="AT-002">AT-002</option>
            <option value="AT-003">AT-003</option>
            <option value="AT-004">AT-004</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="week-phase">Fase</label>
          <select
            id="week-phase"
            value={weekForm.phase}
            onChange={(event) => setWeekForm({ ...weekForm, phase: event.target.value })}
          >
            <option value="Costruzione">Costruzione</option>
            <option value="Intensificazione">Intensificazione</option>
            <option value="Taper">Taper</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="week-load">Carico target</label>
          <input
            id="week-load"
            type="number"
            min="800"
            max="6000"
            step="50"
            value={weekForm.targetLoad}
            onChange={(event) =>
              setWeekForm({ ...weekForm, targetLoad: Number(event.target.value) })
            }
          />
        </div>

        <div className="form-group">
          <label htmlFor="week-focus">Focus</label>
          <input
            id="week-focus"
            type="text"
            value={weekForm.focus}
            onChange={(event) => setWeekForm({ ...weekForm, focus: event.target.value })}
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary">
            Simula microciclo
          </button>
        </div>
      </form>
      {weekMessage ? <p className="notice simulation-notice">{weekMessage}</p> : null}
    </section>
  );
}
