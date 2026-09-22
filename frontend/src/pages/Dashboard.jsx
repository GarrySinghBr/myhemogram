import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
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
            + Import PDF
          </Link>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="brand-mark" />
            <h3>No reports yet</h3>
            <p>Import your first blood work PDF to start tracking results.</p>
            <Link to="/import" className="btn btn-primary" style={{ marginTop: 12 }}>
              Import a PDF
            </Link>
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}
