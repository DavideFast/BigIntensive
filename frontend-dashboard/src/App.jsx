import { useMemo, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";

const pages = [
  { id: "correlation", label: "Matrice correlazione", path: "/correlation" },
  { id: "status", label: "Training status", path: "/training-status" },
  { id: "volume", label: "Volumi", path: "/volumi-allenamento" },
  { id: "add-single", label: "Aggiungi allenamento", path: "/simula-aggiunta-allenamento" },
  { id: "add-week", label: "Pianifica settimana", path: "/simula-aggiunta-allenamenti" },
];

const correlationRows = [
  { metric: "HRV", volume: -0.62, acwr: -0.58, wellness: 0.64, readiness: 0.77 },
  { metric: "RPE", volume: 0.71, acwr: 0.79, wellness: -0.54, readiness: -0.66 },
  { metric: "Monotonia", volume: 0.43, acwr: 0.67, wellness: -0.35, readiness: -0.48 },
  { metric: "Power CMJ", volume: -0.31, acwr: -0.39, wellness: 0.59, readiness: 0.74 },
  { metric: "Soreness", volume: 0.49, acwr: 0.45, wellness: -0.68, readiness: -0.63 },
];

const athletes = [
  { id: "AT-001", name: "Luca Ferri", status: "green", acwr: 0.91, readiness: 86, nextSession: "Forza lower" },
  { id: "AT-002", name: "Marta Leone", status: "amber", acwr: 1.24, readiness: 68, nextSession: "Tecnica sprint" },
  { id: "AT-003", name: "Davide Moretti", status: "red", acwr: 1.58, readiness: 44, nextSession: "Recupero attivo" },
  { id: "AT-004", name: "Giulia Vanni", status: "green", acwr: 0.97, readiness: 82, nextSession: "Plyo breve" },
];

const weeklyVolumes = [
  { day: "Lun", load: 480 },
  { day: "Mar", load: 620 },
  { day: "Mer", load: 710 },
  { day: "Gio", load: 530 },
  { day: "Ven", load: 670 },
  { day: "Sab", load: 390 },
  { day: "Dom", load: 240 },
];

const starterWorkout = {
  athlete: "AT-001",
  sessionType: "Forza",
  duration: 65,
  intensity: 7,
  notes: "",
};

const starterWeek = {
  athlete: "AT-002",
  phase: "Costruzione",
  targetLoad: 3200,
  focus: "Tolleranza lattato",
};

function getCorrelationTone(value) {
  const score = Math.min(1, Math.abs(value));
  if (value >= 0) {
    return `rgba(45, 127, 120, ${0.2 + score * 0.62})`;
  }
  return `rgba(175, 45, 45, ${0.2 + score * 0.62})`;
}

export default function App() {
  const [singleForm, setSingleForm] = useState(starterWorkout);
  const [weekForm, setWeekForm] = useState(starterWeek);
  const [singleMessage, setSingleMessage] = useState("");
  const [weekMessage, setWeekMessage] = useState("");

  const statusSummary = useMemo(() => {
    const total = athletes.length;
    const green = athletes.filter((item) => item.status === "green").length;
    const amber = athletes.filter((item) => item.status === "amber").length;
    const red = athletes.filter((item) => item.status === "red").length;

    return { total, green, amber, red };
  }, []);

  const weeklyStats = useMemo(() => {
    const total = weeklyVolumes.reduce((acc, day) => acc + day.load, 0);
    const avg = Math.round(total / weeklyVolumes.length);
    const max = Math.max(...weeklyVolumes.map((day) => day.load));
    const min = Math.min(...weeklyVolumes.map((day) => day.load));
    return { total, avg, max, min };
  }, []);

  function handleSubmitSingle(event) {
    event.preventDefault();
    setSingleMessage(`Allenamento simulato per ${singleForm.athlete}: ${singleForm.sessionType}, ${singleForm.duration} min, RPE ${singleForm.intensity}.`);
  }

  function handleSubmitWeek(event) {
    event.preventDefault();
    const perDay = Math.round(Number(weekForm.targetLoad) / 7);
    setWeekMessage(`Microciclo creato per ${weekForm.athlete}: fase ${weekForm.phase}, focus ${weekForm.focus}, carico medio giornaliero ${perDay}.`);
  }

  return (
    <div className="page">
      <div className="ambient-shape ambient-shape-a" aria-hidden="true" />
      <div className="ambient-shape ambient-shape-b" aria-hidden="true" />

      <header className="hero">
        <p className="eyebrow">BigIntensive Dashboard</p>
        <h1>Training Intelligence Hub</h1>
        <p className="subtitle">Cinque schermate operative: analisi correlazioni, stato atleti, carichi settimanali e due modalita per simulare inserimenti di allenamento.</p>
        <nav className="page-tabs" aria-label="Schermate principali">
          {pages.map((page) => (
            <NavLink
              key={page.id}
              to={page.path}
              className={({ isActive }) => `tab-btn ${isActive ? "active" : ""}`}
            >
              {page.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="force-plate-section">
        <Routes>
          <Route
            path="/correlation"
            element={
              <section aria-label="Dati matrice di correlazione">
                <h2>Matrice di Correlazione</h2>
                <p className="panel-subtitle">Confronto tra variabili di training load e indicatori di recupero. Celle verdi indicano associazione positiva, rosse associazione negativa.</p>
                <div className="table-wrap correlation-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Variabile</th>
                        <th>Volume</th>
                        <th>ACWR</th>
                        <th>Wellness</th>
                        <th>Readiness</th>
                      </tr>
                    </thead>
                    <tbody>
                      {correlationRows.map((row) => (
                        <tr key={row.metric}>
                          <td>{row.metric}</td>
                          <td style={{ backgroundColor: getCorrelationTone(row.volume) }}>{row.volume.toFixed(2)}</td>
                          <td style={{ backgroundColor: getCorrelationTone(row.acwr) }}>{row.acwr.toFixed(2)}</td>
                          <td style={{ backgroundColor: getCorrelationTone(row.wellness) }}>{row.wellness.toFixed(2)}</td>
                          <td style={{ backgroundColor: getCorrelationTone(row.readiness) }}>{row.readiness.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            }
          />

          <Route
            path="/training-status"
            element={
              <section aria-label="Training status atleti">
                <h2>Training Status</h2>
                <p className="panel-subtitle">Snapshot readiness e rischio per atleta, utile per decidere scarico, mantenimento o incremento del carico.</p>

                <div className="stats-grid">
                  <article className="stat-card">
                    <h2>Atleti monitorati</h2>
                    <p>{statusSummary.total}</p>
                  </article>
                  <article className="stat-card">
                    <h2>Verde</h2>
                    <p>{statusSummary.green}</p>
                  </article>
                  <article className="stat-card">
                    <h2>Giallo</h2>
                    <p>{statusSummary.amber}</p>
                  </article>
                  <article className="stat-card">
                    <h2>Rosso</h2>
                    <p>{statusSummary.red}</p>
                  </article>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Atleta</th>
                        <th>Status</th>
                        <th>ACWR</th>
                        <th>Readiness</th>
                        <th>Prossima sessione</th>
                      </tr>
                    </thead>
                    <tbody>
                      {athletes.map((item) => (
                        <tr key={item.id}>
                          <td>{item.id}</td>
                          <td>{item.name}</td>
                          <td>
                            <span className={`status status-${item.status}`}>{item.status}</span>
                          </td>
                          <td>{item.acwr.toFixed(2)}</td>
                          <td>{item.readiness}</td>
                          <td>{item.nextSession}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            }
          />

          <Route
            path="/volumi-allenamento"
            element={
              <section aria-label="Volumi allenamento settimanali">
                <h2>Volumi Allenamento</h2>
                <p className="panel-subtitle">Distribuzione del carico interno settimanale per evitare picchi improvvisi e migliorare continuita del piano.</p>

                <div className="volume-bars" role="img" aria-label="Grafico a barre dei volumi giornalieri">
                  {weeklyVolumes.map((day) => (
                    <article key={day.day} className="bar-card">
                      <p>{day.day}</p>
                      <div className="bar-shell">
                        <div className="bar-fill" style={{ height: `${Math.round((day.load / weeklyStats.max) * 100)}%` }} />
                      </div>
                      <strong>{day.load}</strong>
                    </article>
                  ))}
                </div>

                <div className="chart-summary">
                  <article className="summary-card">
                    <h3>Volume Totale</h3>
                    <p>{weeklyStats.total}</p>
                  </article>
                  <article className="summary-card">
                    <h3>Media Giornaliera</h3>
                    <p>{weeklyStats.avg}</p>
                  </article>
                  <article className="summary-card">
                    <h3>Range</h3>
                    <p>
                      {weeklyStats.min} - {weeklyStats.max}
                    </p>
                  </article>
                </div>
              </section>
            }
          />

          <Route
            path="/simula-aggiunta-allenamento"
            element={
              <section aria-label="Simulazione aggiunta allenamento singolo">
                <h2>Simula Aggiunta Allenamento</h2>
                <p className="panel-subtitle">Compila il form per simulare il salvataggio di una singola sessione nel planning quotidiano.</p>
                <form className="force-plate-form" onSubmit={handleSubmitSingle}>
                  <div className="form-group">
                    <label htmlFor="single-athlete">Atleta</label>
                    <select id="single-athlete" value={singleForm.athlete} onChange={(event) => setSingleForm({ ...singleForm, athlete: event.target.value })}>
                      <option value="AT-001">AT-001</option>
                      <option value="AT-002">AT-002</option>
                      <option value="AT-003">AT-003</option>
                      <option value="AT-004">AT-004</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="single-type">Tipo sessione</label>
                    <select id="single-type" value={singleForm.sessionType} onChange={(event) => setSingleForm({ ...singleForm, sessionType: event.target.value })}>
                      <option value="Forza">Forza</option>
                      <option value="Tecnica">Tecnica</option>
                      <option value="Recupero">Recupero</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="single-duration">Durata (min)</label>
                    <input id="single-duration" type="number" min="20" max="180" value={singleForm.duration} onChange={(event) => setSingleForm({ ...singleForm, duration: Number(event.target.value) })} />
                  </div>

                  <div className="form-group">
                    <label htmlFor="single-intensity">Intensita percepita (1-10)</label>
                    <input id="single-intensity" type="number" min="1" max="10" value={singleForm.intensity} onChange={(event) => setSingleForm({ ...singleForm, intensity: Number(event.target.value) })} />
                  </div>

                  <div className="form-group">
                    <label htmlFor="single-notes">Note</label>
                    <input id="single-notes" type="text" value={singleForm.notes} onChange={(event) => setSingleForm({ ...singleForm, notes: event.target.value })} placeholder="es. focus tecnico" />
                  </div>

                  <div className="form-actions">
                    <button type="submit" className="btn-primary">
                      Simula inserimento
                    </button>
                  </div>
                </form>
                {singleMessage ? <p className="notice simulation-notice">{singleMessage}</p> : null}
              </section>
            }
          />

          <Route
            path="/simula-aggiunta-allenamenti"
            element={
              <section aria-label="Simulazione pianificazione allenamenti settimanali">
                <h2>Simula Aggiunta Allenamenti Settimanali</h2>
                <p className="panel-subtitle">Seconda schermata di inserimento: crea un microciclo completo e verifica il carico target distribuito.</p>
                <form className="force-plate-form" onSubmit={handleSubmitWeek}>
                  <div className="form-group">
                    <label htmlFor="week-athlete">Atleta</label>
                    <select id="week-athlete" value={weekForm.athlete} onChange={(event) => setWeekForm({ ...weekForm, athlete: event.target.value })}>
                      <option value="AT-001">AT-001</option>
                      <option value="AT-002">AT-002</option>
                      <option value="AT-003">AT-003</option>
                      <option value="AT-004">AT-004</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="week-phase">Fase</label>
                    <select id="week-phase" value={weekForm.phase} onChange={(event) => setWeekForm({ ...weekForm, phase: event.target.value })}>
                      <option value="Costruzione">Costruzione</option>
                      <option value="Intensificazione">Intensificazione</option>
                      <option value="Taper">Taper</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="week-load">Carico target</label>
                    <input id="week-load" type="number" min="800" max="6000" step="50" value={weekForm.targetLoad} onChange={(event) => setWeekForm({ ...weekForm, targetLoad: Number(event.target.value) })} />
                  </div>

                  <div className="form-group">
                    <label htmlFor="week-focus">Focus</label>
                    <input id="week-focus" type="text" value={weekForm.focus} onChange={(event) => setWeekForm({ ...weekForm, focus: event.target.value })} />
                  </div>

                  <div className="form-actions">
                    <button type="submit" className="btn-primary">
                      Simula microciclo
                    </button>
                  </div>
                </form>
                {weekMessage ? <p className="notice simulation-notice">{weekMessage}</p> : null}
              </section>
            }
          />

          <Route path="/" element={<Navigate to="/correlation" replace />} />
          <Route path="*" element={<Navigate to="/correlation" replace />} />
        </Routes>
      </main>
    </div>
  );
}
