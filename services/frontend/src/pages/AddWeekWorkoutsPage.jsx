import { useState } from "react";
import { simulateWeeklyPlan } from "../api/dashboardApi";

export default function AddWeekWorkoutsPage() {
  const [weekForm, setWeekForm] = useState({
    athlete: "AT-002",
    phase: "Costruzione",
    targetLoad: 3200,
    focus: "Tolleranza lattato",
    destination: "citus",
  });
  const [weekMessage, setWeekMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmitWeek(event) {
    event.preventDefault();

    try {
      setSubmitting(true);
      const response = await simulateWeeklyPlan(weekForm);
      const payload = response.payload || {};
      const perDay = response.estimatedDailyLoad || Math.round(Number(weekForm.targetLoad) / 7);
      setWeekMessage(
        `Backend: microciclo per ${payload.athlete || weekForm.athlete}, fase ${payload.phase || weekForm.phase}, focus ${payload.focus || weekForm.focus}, carico medio giornaliero ${perDay}. Destinazione: ${response.destination || weekForm.destination}.`,
      );
    } catch (err) {
      setWeekMessage(`Errore simulazione backend: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
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
          <input
            id="week-athlete"
            type="text"
            value={weekForm.athlete}
            onChange={(event) => setWeekForm({ ...weekForm, athlete: event.target.value })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="week-phase">Fase</label>
          <input
            id="week-phase"
            type="text"
            value={weekForm.phase}
            onChange={(event) => setWeekForm({ ...weekForm, phase: event.target.value })}
          />
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
          <label htmlFor="week-destination">Destinazione database</label>
          <select
            id="week-destination"
            value={weekForm.destination}
            onChange={(event) => setWeekForm({ ...weekForm, destination: event.target.value })}
          >
            <option value="citus">Citus</option>
            <option value="clickhouse">ClickHouse</option>
          </select>
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
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Invio..." : "Simula microciclo"}
          </button>
        </div>
      </form>
      {weekMessage ? <p className="notice simulation-notice">{weekMessage}</p> : null}
    </section>
  );
}
