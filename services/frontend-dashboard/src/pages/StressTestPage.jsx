import { useEffect, useRef, useState } from "react";
import { getLoadtestJob, startLoadtest } from "../api/dashboardApi";

export default function StressTestPage() {
  const [form, setForm] = useState({
    mode: "events",
    vus: 25,
    duration: "60s",
    base_url: "http://backend-api:3001",
  });
  const [job, setJob] = useState(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  async function pollJob(jobId) {
    try {
      const data = await getLoadtestJob(jobId);
      setJob(data);

      if (["completed", "failed"].includes(String(data.status || "").toLowerCase())) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    } catch (err) {
      setNotice(`Errore polling job: ${err.message}`);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }

  async function handleStart(event) {
    event.preventDefault();

    try {
      setLoading(true);
      setNotice("");
      const response = await startLoadtest({
        mode: form.mode,
        vus: Number(form.vus),
        duration: form.duration,
        base_url: form.base_url,
      });

      setNotice(`Stress test avviato. Job ID: ${response.jobId}`);
      setJob({
        id: response.jobId,
        status: "starting",
        mode: response.mode,
        vus: response.vus,
        duration: response.duration,
        baseUrl: response.baseUrl,
      });

      if (pollRef.current) {
        clearInterval(pollRef.current);
      }

      pollRef.current = setInterval(() => {
        pollJob(response.jobId);
      }, 2000);

      await pollJob(response.jobId);
    } catch (err) {
      setNotice(`Errore avvio stress test: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const status = String(job?.status || "idle").toLowerCase();
  const statusClass = status === "completed"
    ? "status status-green"
    : status === "failed"
      ? "status status-red"
      : status === "running" || status === "starting"
        ? "status status-amber"
        : "status status-unknown";

  return (
    <section aria-label="Stress test backend da frontend">
      <h2>Stress Test Backend (k6)</h2>
      <p className="panel-subtitle">
        Avvii lo stress test dal frontend, ma il carico viene generato dal backend tramite container
        k6 su Docker network interna.
      </p>

      <form className="force-plate-form" onSubmit={handleStart}>
        <div className="form-group">
          <label htmlFor="lt-mode">Modalita endpoint</label>
          <select
            id="lt-mode"
            value={form.mode}
            onChange={(event) => setForm({ ...form, mode: event.target.value })}
          >
            <option value="events">events</option>
            <option value="force-plate">force-plate</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="lt-vus">VUs</label>
          <input
            id="lt-vus"
            type="number"
            min="1"
            max="1000"
            value={form.vus}
            onChange={(event) => setForm({ ...form, vus: Number(event.target.value) })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="lt-duration">Durata</label>
          <input
            id="lt-duration"
            type="text"
            value={form.duration}
            onChange={(event) => setForm({ ...form, duration: event.target.value })}
            placeholder="es. 30s, 2m"
          />
          <span className="form-help">Formato consentito: numero + s/m/h (esempio 90s, 3m)</span>
        </div>

        <div className="form-group">
          <label htmlFor="lt-base-url">Base URL target</label>
          <input
            id="lt-base-url"
            type="text"
            value={form.base_url}
            onChange={(event) => setForm({ ...form, base_url: event.target.value })}
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Avvio..." : "Avvia stress test"}
          </button>
        </div>
      </form>

      {notice ? <p className="notice simulation-notice">{notice}</p> : null}

      {job ? (
        <div className="table-wrap" style={{ marginTop: "1rem" }}>
          <table>
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Status</th>
                <th>Mode</th>
                <th>VUs</th>
                <th>Durata</th>
                <th>Base URL</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{job.id}</td>
                <td><span className={statusClass}>{job.status || "idle"}</span></td>
                <td>{job.mode}</td>
                <td>{job.vus}</td>
                <td>{job.duration}</td>
                <td>{job.baseUrl}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      {job?.outputTail ? (
        <div className="table-wrap" style={{ marginTop: "1rem", padding: "0.85rem" }}>
          <p className="api-target" style={{ marginTop: 0 }}>Output k6 (tail)</p>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "IBM Plex Mono, monospace", fontSize: "0.82rem" }}>
            {job.outputTail}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
