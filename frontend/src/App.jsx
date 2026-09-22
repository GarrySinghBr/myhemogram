import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Import from "./pages/Import";
import ReportDetail from "./pages/ReportDetail";
import Trends from "./pages/Trends";
import Compare from "./pages/Compare";

export default function App() {
  return (
    <div className="app-shell">
      <header className="topnav">
        <div className="brand">
          <span className="brand-mark" />
          MyHemogram
        </div>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Reports
          </NavLink>
          <NavLink to="/trends" className={({ isActive }) => (isActive ? "active" : "")}>
            Trends
          </NavLink>
        </nav>
        <div className="topnav-spacer" />
        <NavLink to="/import" className="btn btn-primary btn-sm">
          + Import PDF
        </NavLink>
      </header>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/import" element={<Import />} />
        <Route path="/reports/:id" element={<ReportDetail />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/compare" element={<Compare />} />
      </Routes>
    </div>
  );
}
