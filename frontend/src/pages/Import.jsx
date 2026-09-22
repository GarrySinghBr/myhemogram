import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import ReviewTable from "../components/ReviewTable";
import { UploadIcon } from "../components/icons";

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
  const [fileName, setFileName] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null); // { collected_on, ordering_physician, results, upload_token, source_filename }
  const fileInput = useRef();
  const navigate = useNavigate();

  async function handleFile(file) {
    if (!file) return;
    setError(null);
    setFileName(file.name);
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
          <h1>{preview ? "Review before saving" : "Upload a report"}</h1>
          <div className="page-subtitle">
            {preview
              ? "Fix anything below that the parser missed or misread, then save."
              : "Nothing is saved until you've checked it on the next screen."}
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
            <div className="dropzone-icon">
              <UploadIcon width={18} height={18} />
            </div>
            <div style={{ flex: 1 }}>
              {loading ? (
                <>
                  <strong>Reading {fileName}…</strong>
                  <div className="muted" style={{ marginTop: 2, fontSize: 12.5 }}>
                    Parsing on this machine — this can take a few seconds for a longer report.
                  </div>
                </>
              ) : (
                <>
                  <strong>Choose a PDF, or drag one in</strong>
                  <div className="muted" style={{ marginTop: 2, fontSize: 12.5 }}>
                    The lab report your doctor's office sends you, unmodified.
                  </div>
                </>
              )}
            </div>
            {loading && <span className="spinner" />}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <div style={{ marginTop: 14 }}>
            <button className="link-btn" onClick={startManual}>
              Enter a report manually instead
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
