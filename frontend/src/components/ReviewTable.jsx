import { Fragment, useState } from "react";

const FIELDS = [
  { key: "panel", label: "Panel", width: 110 },
  { key: "group_name", label: "Group", width: 110 },
  { key: "analyte_name", label: "Analyte", width: 160 },
  { key: "value_text", label: "Value", width: 90 },
  { key: "unit", label: "Unit", width: 90 },
  { key: "ref_low", label: "Ref low", width: 80, numeric: true },
  { key: "ref_high", label: "Ref high", width: 80, numeric: true },
  { key: "flag", label: "Flag", width: 70 },
];

function toNumeric(text) {
  const m = String(text).match(/-?\d+\.?\d*/);
  return m ? parseFloat(m[0]) : null;
}

export default function ReviewTable({ results, onChange, onDelete, onAdd }) {
  const [openNotes, setOpenNotes] = useState(null);

  function update(idx, key, value) {
    const patch = { [key]: value };
    if (key === "value_text") patch.value_numeric = toNumeric(value);
    if (key === "ref_low" || key === "ref_high") patch[key] = value === "" ? null : parseFloat(value);
    onChange(idx, patch);
  }

  return (
    <div>
      <table>
        <thead>
          <tr>
            {FIELDS.map((f) => (
              <th key={f.key}>{f.label}</th>
            ))}
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, idx) => (
            <Fragment key={idx}>
              <tr style={r.needs_review ? { background: "var(--serious-soft)" } : undefined}>
                {FIELDS.map((f) => (
                  <td key={f.key}>
                    <input
                      value={r[f.key] ?? ""}
                      onChange={(e) => update(idx, f.key, e.target.value)}
                      style={{ minWidth: f.width }}
                    />
                  </td>
                ))}
                <td>
                  <button className="link-btn" onClick={() => setOpenNotes(openNotes === idx ? null : idx)}>
                    {r.notes ? "View note" : "—"}
                  </button>
                </td>
                <td>
                  <button className="btn btn-sm btn-danger" onClick={() => onDelete(idx)}>
                    Remove
                  </button>
                </td>
              </tr>
              {openNotes === idx && (
                <tr>
                  <td colSpan={FIELDS.length + 2}>
                    <textarea
                      rows={3}
                      value={r.notes ?? ""}
                      onChange={(e) => update(idx, "notes", e.target.value)}
                      placeholder="Interpretive notes from the report (optional)"
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 12 }}>
        <button className="btn btn-sm" onClick={onAdd}>
          + Add row
        </button>
      </div>
    </div>
  );
}
