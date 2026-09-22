import { Fragment, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import FlagBadge from "../components/FlagBadge";
import RangeBar from "../components/RangeBar";
import { formatDate, formatValue } from "../utils";

const EMPTY_ROW = {
  panel: "",
  group_name: "",
  analyte_name: "",
  value_text: "",
  value_numeric: null,
  unit: "",
  ref_low: null,
  ref_high: null,
  flag: "",
  notes: "",
};

function ResultRow({ result, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(result);
  const [showNotes, setShowNotes] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const payload = { ...form, ref_low: form.ref_low === "" ? null : form.ref_low, ref_high: form.ref_high === "" ? null : form.ref_high };
      const saved = await api.updateResult(result.id, payload);
      onSaved(saved);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm(`Delete ${result.analyte_name}?`)) return;
    await api.deleteResult(result.id);
    onDeleted(result.id);
  }

  if (editing) {
    return (
      <tr>
        <td colSpan={6}>
          <div className="field-row">
            <div className="field">
              <label>Analyte</label>
              <input value={form.analyte_name} onChange={(e) => setForm({ ...form, analyte_name: e.target.value })} />
            </div>
            <div className="field">
              <label>Value</label>
              <input value={form.value_text} onChange={(e) => setForm({ ...form, value_text: e.target.value, value_numeric: parseFloat(e.target.value) || null })} />
            </div>
            <div className="field">
              <label>Unit</label>
              <input value={form.unit || ""} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div className="field">
              <label>Ref low</label>
              <input value={form.ref_low ?? ""} onChange={(e) => setForm({ ...form, ref_low: e.target.value })} />
            </div>
            <div className="field">
              <label>Ref high</label>
              <input value={form.ref_high ?? ""} onChange={(e) => setForm({ ...form, ref_high: e.target.value })} />
            </div>
            <div className="field">
              <label>Flag</label>
              <input value={form.flag || ""} onChange={(e) => setForm({ ...form, flag: e.target.value })} placeholder="H / L" />
            </div>
          </div>
          <div className="toolbar">
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>Save</button>
            <button className="btn btn-sm" onClick={() => { setEditing(false); setForm(result); }}>Cancel</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr>
        <td>
          {result.analyte_name}
          {result.notes && (
            <button className="link-btn" style={{ marginLeft: 8 }} onClick={() => setShowNotes((s) => !s)}>
              note
            </button>
          )}
        </td>
        <td className="num">{formatValue(result)} {result.unit}</td>
        <td>
          <RangeBar result={result} />
        </td>
        <td>
          <FlagBadge flag={result.flag} />
        </td>
        <td>
          <Link className="link-btn" to={`/trends?analyte=${encodeURIComponent(result.analyte_name)}`}>trend</Link>
        </td>
        <td>
          <div className="toolbar">
            <button className="link-btn" onClick={() => setEditing(true)}>Edit</button>
            <button className="link-btn" onClick={del} style={{ color: "var(--critical)" }}>Delete</button>
          </div>
        </td>
      </tr>
      {showNotes && (
        <tr>
          <td colSpan={6} className="secondary-text" style={{ fontSize: 12.5 }}>
            {result.notes}
          </td>
        </tr>
      )}
    </>
  );
}

export default function ReportDetail() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [addingTo, setAddingTo] = useState(null);
  const [newRow, setNewRow] = useState(EMPTY_ROW);
  const [allReports, setAllReports] = useState([]);
  const navigate = useNavigate();

  function load() {
    api.getReport(id).then(setReport).catch((e) => setError(e.message));
  }

  useEffect(load, [id]);
  useEffect(() => {
    api.listReports().then(setAllReports).catch(() => {});
  }, []);

  if (error) return <div className="page"><div className="error-banner">{error}</div></div>;
  if (!report) return <div className="page"><span className="spinner" /></div>;

  // Group by panel, but keep results in their original (parsed) order within
  // each panel and only break out a group heading when the group actually
  // changes -- a plain bucket-by-name would scatter a group's later members
  // away from its first if something else briefly interrupts the same name.
  const panelOrder = [];
  const panelRows = {};
  for (const r of report.results) {
    const panel = r.panel || "Other";
    if (!panelRows[panel]) {
      panelRows[panel] = [];
      panelOrder.push(panel);
    }
    panelRows[panel].push(r);
  }

  function patchResult(updated) {
    setReport((r) => ({ ...r, results: r.results.map((x) => (x.id === updated.id ? updated : x)) }));
  }
  function removeResult(resultId) {
    setReport((r) => ({ ...r, results: r.results.filter((x) => x.id !== resultId) }));
  }

  async function saveNewRow(panel) {
    const payload = { ...newRow, panel, ref_low: newRow.ref_low || null, ref_high: newRow.ref_high || null };
    const saved = await api.addResult(report.id, payload);
    setReport((r) => ({ ...r, results: [...r.results, saved] }));
    setAddingTo(null);
    setNewRow(EMPTY_ROW);
  }

  async function handleDeleteReport() {
    if (!confirm("Delete this entire report and all its results? This cannot be undone.")) return;
    await api.deleteReport(report.id);
    navigate("/");
  }

  const otherReports = allReports.filter((r) => r.id !== report.id);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{formatDate(report.collected_on)}</h1>
          <div className="page-subtitle">
            {report.ordering_physician || "No physician on file"} · {report.results.length} results
            {report.needs_review && <span className="review-badge" style={{ marginLeft: 8 }}>Needs review</span>}
          </div>
        </div>
        <div className="toolbar">
          {report.source_filename && (
            <a className="btn btn-sm" href={api.reportPdfUrl(report.id)} target="_blank" rel="noreferrer">
              Original PDF
            </a>
          )}
          {otherReports.length > 0 && (
            <select
              className="btn btn-sm"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) navigate(`/compare?ids=${report.id},${e.target.value}`);
              }}
            >
              <option value="" disabled>Compare with…</option>
              {otherReports.map((r) => (
                <option key={r.id} value={r.id}>{formatDate(r.collected_on)}</option>
              ))}
            </select>
          )}
          <button className="btn btn-sm btn-danger" onClick={handleDeleteReport}>Delete report</button>
        </div>
      </div>

      {panelOrder.map((panel) => (
        <div className="card" key={panel}>
          <div className="panel-heading">{panel}</div>
          <table>
            <tbody>
              {(() => {
                let lastGroup = null;
                return panelRows[panel].map((r) => {
                  const group = r.group_name || "";
                  const showHeading = group && group !== lastGroup;
                  lastGroup = group;
                  return (
                    <Fragment key={r.id}>
                      {showHeading && (
                        <tr>
                          <td colSpan={6} className="group-heading">{group}</td>
                        </tr>
                      )}
                      <ResultRow result={r} onSaved={patchResult} onDeleted={removeResult} />
                    </Fragment>
                  );
                });
              })()}
              {addingTo === panel ? (
                <tr>
                  <td colSpan={6}>
                    <div className="field-row">
                      <div className="field">
                        <label>Analyte</label>
                        <input value={newRow.analyte_name} onChange={(e) => setNewRow({ ...newRow, analyte_name: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>Value</label>
                        <input value={newRow.value_text} onChange={(e) => setNewRow({ ...newRow, value_text: e.target.value, value_numeric: parseFloat(e.target.value) || null })} />
                      </div>
                      <div className="field">
                        <label>Unit</label>
                        <input value={newRow.unit || ""} onChange={(e) => setNewRow({ ...newRow, unit: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>Ref low</label>
                        <input value={newRow.ref_low ?? ""} onChange={(e) => setNewRow({ ...newRow, ref_low: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>Ref high</label>
                        <input value={newRow.ref_high ?? ""} onChange={(e) => setNewRow({ ...newRow, ref_high: e.target.value })} />
                      </div>
                    </div>
                    <div className="toolbar">
                      <button className="btn btn-primary btn-sm" onClick={() => saveNewRow(panel)}>Add</button>
                      <button className="btn btn-sm" onClick={() => setAddingTo(null)}>Cancel</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={6}>
                    <button className="link-btn" onClick={() => { setAddingTo(panel); setNewRow(EMPTY_ROW); }}>
                      + Add result to {panel}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
