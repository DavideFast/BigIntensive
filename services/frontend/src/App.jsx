import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import ClickhouseConnectionPage from "./pages/ClickhouseConnection";
import PostgresConnectionPage from "./pages/PostgresConnection";

const pages = [
  { id: "postgres", label: "PostgreSQL", path: "/postgres" },
  { id: "clickhouse", label: "ClickHouse", path: "/clickhouse" },
];

export default function App() {
  return (
    <div className="page">
      <div className="ambient-shape ambient-shape-a" aria-hidden="true" />
      <div className="ambient-shape ambient-shape-b" aria-hidden="true" />

      <header className="hero">
        <p className="eyebrow">BigIntensive Dashboard</p>
        <h1>Database connections</h1>
        <p className="subtitle">Consultazione e test delle connessioni PostgreSQL e ClickHouse.</p>
        <nav className="page-tabs" aria-label="Schermate principali">
          {pages.map((page) => (
            <NavLink key={page.id} to={page.path} className={({ isActive }) => `tab-btn ${isActive ? "active" : ""}`}>
              {page.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="force-plate-section">
        <Routes>
          <Route path="/postgres" element={<PostgresConnectionPage />} />
          <Route path="/clickhouse" element={<ClickhouseConnectionPage />} />
          <Route path="/" element={<Navigate to="/postgres" replace />} />
          <Route path="*" element={<Navigate to="/postgres" replace />} />
        </Routes>
      </main>
    </div>
  );
}
