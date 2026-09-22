import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import ReviewTable from "../components/ReviewTable";

const BLANK_RESULT = {
  panel: "",
  group_name: "",
  analyte_name: "",
  raw_name: "",
  value_text: "",
  value_numeric: null,
  comparator: null,
  unit: "",
  ref_range_text: "",
  ref_low: null,
  ref_high: null,
  flag: "",
  notes: "",
};

export default function Import() {
  const [mode, setMode] = useState("pdf"); // "pdf" | "manual"
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null); // { collected_on, ordering_physician, results, upload_token, source_filename }
  const fileInput = useRef();
  const navigate = useNavigate();

  async function handleFile(file) {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const parsed = await api.parsePdf(file);
      setPreview(parsed);
    } catch (e) {
      setError(e.message || "Could not parse this PDF.");
    } finally {
      setLoading(false);
    }
  }

  function startManual() {
    setMode("manual");
    setPreview({
      collected_on: new Date().toISOString().slice(0, 10),
      requested_on: null,
      reported_on: null,
      ordering_physician: "",
      results: [],
      source_filename: null,
      upload_token: null,
    });
  }

  function updateMeta(key, value) {
    setPreview((p) => ({ ...p, [key]: value }));
  }

  function updateResult(idx, patch) {
    setPreview((p) => {
      const results = [...p.results];
      results[idx] = { ...results[idx], ...patch };
      return { ...p, results };
    });
  }

  function deleteResultRow(idx) {
    setPreview((p) => ({ ...p, results: p.results.filter((_, i) => i !== idx) }));
  }

  function addResultRow() {
    setPreview((p) => ({ ...p, results: [...p.results, { ...BLANK_RESULT }] }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        collected_on: preview.collected_on,
        requested_on: preview.requested_on || null,
        reported_on: preview.reported_on || null,
        ordering_physician: preview.ordering_physician || null,
        source_filename: preview.source_filename || null,
        results: preview.results.map(({ needs_review, ...r }) => r),
      };
      const saved = await api.createReport(payload, preview.upload_token);
      navigate(`/reports/${saved.id}`);
    } catch (e) {
      setError(e.message || "Could not save this report.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{preview ? "Review before saving" : "Import a blood work report"}</h1>
          <div className="page-subtitle">
            {preview
              ? "Fix anything the parser missed or misread, then save."
              : "Upload the PDF from your doctor, or add a report by hand."}
          </div>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {!preview && (
        <div className="card card-pad">
          <div
            className={`dropzone ${dragActive ? "active" : ""}`}
            onClick={() => fileInput.current.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
          >
            {loading ? (
              <span className="spinner" />
            ) : (
              <>
                <strong>Drop a PDF here or click to browse</strong>
                <div className="muted" style={{ marginTop: 4 }}>
                  The report will be parsed and shown to you for review before anything is saved.
                </div>
              </>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <button className="link-btn" onClick={startManual}>
              Or add a report manually instead
            </button>
          </div>
        </div>
      )}

      {preview && (
        <>
          <div className="card card-pad">
            <div className="field-row">
              <div className="field">
                <label>Collected on</label>
                <input
                  type="date"
                  value={preview.collected_on || ""}
                  onChange={(e) => updateMeta("collected_on", e.target.value)}
                />
              </div>
              <div className="field">
                <label>Ordering physician</label>
                <input
                  value={preview.ordering_physician || ""}
                  onChange={(e) => updateMeta("ordering_physician", e.target.value)}
                />
              </div>
              <div className="field">
                <label>Source</label>
                <input value={preview.source_filename || "Manual entry"} disabled />
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <ReviewTable
              results={preview.results}
              onChange={updateResult}
              onDelete={deleteResultRow}
              onAdd={addResultRow}
            />
          </div>

          <div className="toolbar" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" disabled={saving || !preview.collected_on} onClick={handleSave}>
              {saving ? "Saving…" : "Save report"}
            </button>
            <button className="btn" onClick={() => { setPreview(null); setMode("pdf"); }}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
