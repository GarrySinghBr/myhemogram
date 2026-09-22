import { Link, NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Import from "./pages/Import";
import ReportDetail from "./pages/ReportDetail";
import Trends from "./pages/Trends";
import Compare from "./pages/Compare";
import { LogoMark } from "./components/icons";
import ThemeSwitcher from "./components/ThemeSwitcher";

export default function App() {
  return (
    <div className="app-shell">
      <header className="topnav">
        <Link to="/" className="brand">
          <LogoMark />
          <span>MyHemogram</span>
        </Link>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Reports
          </NavLink>
          <NavLink to="/trends" className={({ isActive }) => (isActive ? "active" : "")}>
            Trends
          </NavLink>
        </nav>
        <div className="topnav-spacer" />
        <ThemeSwitcher />
        <NavLink to="/import" className="btn btn-primary btn-sm">
          Upload report
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
