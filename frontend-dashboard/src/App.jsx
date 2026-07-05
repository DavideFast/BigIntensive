import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import AddSingleWorkoutPage from "./pages/AddSingleWorkoutPage";
import AddWeekWorkoutsPage from "./pages/AddWeekWorkoutsPage";
import CorrelationPage from "./pages/CorrelationPage";
import TrainingStatusPage from "./pages/TrainingStatusPage";
import VolumePage from "./pages/VolumePage";

const pages = [
  { id: "correlation", label: "Matrice correlazione", path: "/correlation" },
  { id: "status", label: "Training status", path: "/training-status" },
  { id: "volume", label: "Volumi", path: "/volumi-allenamento" },
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
          Cinque schermate operative: analisi correlazioni, stato atleti, carichi settimanali e due
          modalita per simulare inserimenti di allenamento.
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
          <Route path="/simula-aggiunta-allenamento" element={<AddSingleWorkoutPage />} />
          <Route path="/simula-aggiunta-allenamenti" element={<AddWeekWorkoutsPage />} />
          <Route path="/" element={<Navigate to="/correlation" replace />} />
          <Route path="*" element={<Navigate to="/correlation" replace />} />
        </Routes>
      </main>
    </div>
  );
}
