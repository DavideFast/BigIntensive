import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import AddSingleWorkoutPage from "./pages/AddSingleWorkoutPage";
import AddWeekWorkoutsPage from "./pages/AddWeekWorkoutsPage";
import CorrelationPage from "./pages/CorrelationPage";
import RunningChartPage from "./pages/RunningChartPage";
import SmartwatchSimulatorPage from "./pages/SmartwatchSimulatorPage";
import StressTestPage from "./pages/StressTestPage";
import TrainingStatusPage from "./pages/TrainingStatusPage";
import VolumePage from "./pages/VolumePage";
import WorkoutsClickhousePage from "./pages/WorkoutsClickhousePage";

const pages = [
  { id: "correlation", label: "Matrice correlazione", path: "/correlation" },
  { id: "status", label: "Training status", path: "/training-status" },
  { id: "volume", label: "Volumi", path: "/volumi-allenamento" },
  { id: "running", label: "Grafico corsa", path: "/grafico-corsa" },
  { id: "smartwatch", label: "Simulatore smartwatch", path: "/simulatore-smartwatch" },
  { id: "stress", label: "Stress test", path: "/stress-test" },
  { id: "workouts-ch", label: "Grafico CH allenamenti", path: "/grafico-clickhouse-allenamenti" },
  { id: "add-single", label: "Aggiungi allenamento", path: "/simula-aggiunta-allenamento" },
  { id: "add-week", label: "Pianifica settimana", path: "/simula-aggiunta-allenamenti" },
];

export default function App() {
  return (
    <div className="page">
      <div className="ambient-shape ambient-shape-a" aria-hidden="true" />
      <div className="ambient-shape ambient-shape-b" aria-hidden="true" />

      <header className="hero">
        <p className="eyebrow">BigIntensive Dashboard</p>
        <h1>Training Intelligence Hub</h1>
        <p className="subtitle">
          Dashboard operativa con analisi correlazioni, stato atleti, volumi, grafici ClickHouse e
          simulatori di inserimento dati per allenamenti e smartwatch.
        </p>
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
          <Route path="/correlation" element={<CorrelationPage />} />
          <Route path="/training-status" element={<TrainingStatusPage />} />
          <Route path="/volumi-allenamento" element={<VolumePage />} />
          <Route path="/grafico-corsa" element={<RunningChartPage />} />
          <Route path="/simulatore-smartwatch" element={<SmartwatchSimulatorPage />} />
          <Route path="/stress-test" element={<StressTestPage />} />
          <Route path="/grafico-clickhouse-allenamenti" element={<WorkoutsClickhousePage />} />
          <Route path="/simula-aggiunta-allenamento" element={<AddSingleWorkoutPage />} />
          <Route path="/simula-aggiunta-allenamenti" element={<AddWeekWorkoutsPage />} />
          <Route path="/" element={<Navigate to="/correlation" replace />} />
          <Route path="*" element={<Navigate to="/correlation" replace />} />
        </Routes>
      </main>
    </div>
  );
}
