import { useState } from "react";
import {
  endSmartwatchSession,
  sendSmartwatchSamples,
  startSmartwatchSession,
} from "../api/dashboardApi";

function buildSamples(form) {
  const count = Math.max(1, Number(form.count) || 1);
  const now = Date.now();

  return Array.from({ length: count }, (_, index) => ({
    heart_rate_bpm: Number(form.heartRate) + index,
    cadence_spm: Number(form.cadence),
    speed_kmh: Number(form.speed),
    altitude_m: Number(form.altitude),
    temperature_c: Number(form.temperature),
    timestamp: new Date(now + index * 1000).toISOString(),
  }));
}

export default function SmartwatchSimulatorPage() {
  const [sessionForm, setSessionForm] = useState({
    athleteId: 1,
    topic: "heart-rate-events",
  });
  const [samplesForm, setSamplesForm] = useState({
    count: 5,
    heartRate: 148,
    cadence: 172,
    speed: 11.4,
    altitude: 245.2,
    temperature: 20.0,
  });

  const [activeSession, setActiveSession] = useState(null);
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingEnd, setLoadingEnd] = useState(false);
  const [notice, setNotice] = useState("");

  async function handleStartSession(event) {
    event.preventDefault();

    try {
      setLoadingStart(true);
      const response = await startSmartwatchSession({
        athlete_id: Number(sessionForm.athleteId),
        topic: sessionForm.topic,
      });

      setActiveSession(response.session || null);
      setNotice(`Sessione avviata: id ${response?.session?.session_id}, topic ${response?.session?.topic}`);
    } catch (err) {
      setNotice(`Errore avvio sessione: ${err.message}`);
    } finally {
      setLoadingStart(false);
    }
  }

  async function handleSendSamples(event) {
    event.preventDefault();
    if (!activeSession?.session_id) {
      setNotice("Avvia prima una sessione smartwatch.");
      return;
    }

    try {
      setLoadingSend(true);
      const response = await sendSmartwatchSamples(activeSession.session_id, {
        destination: "kafka",
        samples: buildSamples(samplesForm),
      });

      setActiveSession(response.session || activeSession);
      setNotice(`Campioni inviati a Kafka: ${response.sent_count} sul topic ${response.topic}.`);
    } catch (err) {
      setNotice(`Errore invio campioni: ${err.message}`);
    } finally {
      setLoadingSend(false);
    }
  }

  async function handleEndSession() {
    if (!activeSession?.session_id) {
      setNotice("Nessuna sessione attiva da chiudere.");
      return;
    }

    try {
      setLoadingEnd(true);
      const response = await endSmartwatchSession(activeSession.session_id, {
        reason: "frontend-sim-end",
      });

      setNotice(`Sessione chiusa: id ${response?.session?.session_id}, campioni totali ${response?.session?.samples_sent}.`);
      setActiveSession(null);
    } catch (err) {
      setNotice(`Errore chiusura sessione: ${err.message}`);
    } finally {
      setLoadingEnd(false);
    }
  }

  return (
    <section aria-label="Simulatore smartwatch">
      <h2>Simulatore Smartwatch</h2>
      <p className="panel-subtitle">
        Inserisce dati di corsa passando dal backend e pubblicando su Kafka.
      </p>

      <form className="force-plate-form" onSubmit={handleStartSession}>
        <div className="form-group">
          <label htmlFor="sw-athlete-id">Athlete ID</label>
          <input
            id="sw-athlete-id"
            type="number"
            min="1"
            value={sessionForm.athleteId}
            onChange={(event) =>
              setSessionForm({ ...sessionForm, athleteId: Number(event.target.value) })
            }
          />
        </div>
        <div className="form-group">
          <label htmlFor="sw-topic">Kafka topic</label>
          <input
            id="sw-topic"
            type="text"
            value={sessionForm.topic}
            onChange={(event) => setSessionForm({ ...sessionForm, topic: event.target.value })}
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={loadingStart}>
            {loadingStart ? "Avvio..." : "Avvia sessione"}
          </button>
        </div>
      </form>

      <form className="force-plate-form" onSubmit={handleSendSamples}>
        <div className="form-group">
          <label htmlFor="sw-count">Numero campioni</label>
          <input
            id="sw-count"
            type="number"
            min="1"
            max="120"
            value={samplesForm.count}
            onChange={(event) => setSamplesForm({ ...samplesForm, count: Number(event.target.value) })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="sw-hr">Heart rate bpm</label>
          <input
            id="sw-hr"
            type="number"
            value={samplesForm.heartRate}
            onChange={(event) => setSamplesForm({ ...samplesForm, heartRate: Number(event.target.value) })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="sw-cadence">Cadence spm</label>
          <input
            id="sw-cadence"
            type="number"
            value={samplesForm.cadence}
            onChange={(event) => setSamplesForm({ ...samplesForm, cadence: Number(event.target.value) })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="sw-speed">Speed km/h</label>
          <input
            id="sw-speed"
            type="number"
            step="0.1"
            value={samplesForm.speed}
            onChange={(event) => setSamplesForm({ ...samplesForm, speed: Number(event.target.value) })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="sw-alt">Altitude m</label>
          <input
            id="sw-alt"
            type="number"
            step="0.1"
            value={samplesForm.altitude}
            onChange={(event) => setSamplesForm({ ...samplesForm, altitude: Number(event.target.value) })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="sw-temp">Temperature C</label>
          <input
            id="sw-temp"
            type="number"
            step="0.1"
            value={samplesForm.temperature}
            onChange={(event) => setSamplesForm({ ...samplesForm, temperature: Number(event.target.value) })}
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={loadingSend || !activeSession}>
            {loadingSend ? "Invio..." : "Invia campioni a Kafka"}
          </button>
          <button
            type="button"
            className="btn-primary btn-secondary"
            onClick={handleEndSession}
            disabled={loadingEnd || !activeSession}
          >
            {loadingEnd ? "Chiusura..." : "Chiudi sessione"}
          </button>
        </div>
      </form>

      {activeSession ? (
        <p className="api-target">
          Sessione attiva: id {activeSession.session_id} | atleta {activeSession.athlete_id} | topic {activeSession.topic} | campioni inviati {activeSession.samples_sent}
        </p>
      ) : (
        <p className="api-target">Nessuna sessione attiva.</p>
      )}

      {notice ? <p className="notice simulation-notice">{notice}</p> : null}
    </section>
  );
}
