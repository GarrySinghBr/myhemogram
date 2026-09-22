import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { CompareIcon, DocumentIcon, LogoMark, TrendIcon } from "../components/icons";
import { formatDate } from "../utils";

export default function Dashboard() {
  const [reports, setReports] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.listReports().then(setReports).catch((e) => setError(e.message));
  }, []);

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("Delete this report and all its results? This cannot be undone.")) return;
    await api.deleteReport(id);
    setReports((prev) => prev.filter((r) => r.id !== id));
    setSelected((prev) => prev.filter((x) => x !== id));
  }

  if (error) return <div className="page"><div className="error-banner">{error}</div></div>;
  if (!reports) return <div className="page"><span className="spinner" /></div>;

  // First run, before any report exists, this page doubles as the app's
  // landing page - explaining what it does - rather than an empty table
  // with nothing to click on. Once there's real data the plain report list
  // below is more useful than repeating that pitch on every visit.
  if (reports.length === 0) {
    return (
      <div className="page">
        <div className="hero">
          <div className="hero-icon">
            <LogoMark size={20} />
          </div>
          <h1>A private record of your blood work, over time</h1>
          <p className="lede">
            Your doctor sends results as a PDF for one point in time. MyHemogram reads
            each one, keeps every value on file, and lines them up so you can see how
            a marker is actually trending — not just what it says today. Everything is
            stored locally; nothing leaves this computer.
          </p>
          <div className="actions">
            <Link to="/import" className="btn btn-primary">Upload your first report</Link>
          </div>

          <div className="feature-grid">
            <div className="feature-item">
              <div className="feature-icon"><DocumentIcon width={18} height={18} /></div>
              <h3>Reads your lab PDF</h3>
              <p>Upload the report as-is. Every result is pulled out and shown to you for a quick check before anything is saved.</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon"><CompareIcon width={18} height={18} /></div>
              <h3>Compares two reports</h3>
              <p>Put any two visits side by side and see exactly what moved, by how much, and in which direction.</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon"><TrendIcon width={18} height={18} /></div>
              <h3>Tracks the trend</h3>
              <p>Every analyte gets its own history and chart, with the reference range shown alongside it.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Blood work reports</h1>
          <div className="page-subtitle">{reports.length} report{reports.length === 1 ? "" : "s"} on file</div>
        </div>
        <div className="toolbar">
          {selected.length >= 2 && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/compare?ids=${selected.join(",")}`)}>
              Compare {selected.length} selected
            </button>
          )}
          <Link to="/import" className="btn btn-sm">
            Upload report
          </Link>
        </div>
      </div>

      <div className="card">
          <table>
            <thead>
              <tr>
                <th style={{ width: 28 }}></th>
                <th>Collected</th>
                <th>Physician</th>
                <th>Source</th>
                <th>Results</th>
                <th>Abnormal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/reports/${r.id}`)} style={{ cursor: "pointer" }}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
                  </td>
                  <td>
                    {formatDate(r.collected_on)}
                    {r.needs_review && <span className="review-badge" style={{ marginLeft: 8 }}>Needs review</span>}
                  </td>
                  <td className="secondary-text">{r.ordering_physician || "—"}</td>
                  <td className="secondary-text">{r.source_filename || "Manual entry"}</td>
                  <td className="num">{r.result_count}</td>
                  <td>
                    {r.abnormal_count > 0 ? (
                      <span className="flag-badge high">{r.abnormal_count} flagged</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={(e) => handleDelete(r.id, e)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
    </div>
  );
}
