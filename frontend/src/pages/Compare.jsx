import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import FlagBadge from "../components/FlagBadge";
import { formatDate, formatValue } from "../utils";

function DeltaCell({ delta, percentChange }) {
  if (delta == null) return <span className="muted">—</span>;
  const up = delta > 0;
  const flat = delta === 0;
  // Red-for-up / green-for-down is a plain directional cue (did the number
  // get bigger or smaller), not a clinical verdict - a rising value isn't
  // necessarily bad, nor a falling one good. Reading whether that direction
  // matters still means looking at the flag/reference range next to it.
  const color = flat ? "var(--text-muted)" : up ? "var(--critical)" : "var(--good)";
  return (
    <span className="num" style={{ color }}>
      {flat ? "→" : up ? "↑" : "↓"} {Math.abs(delta).toFixed(2)}
      {percentChange != null && ` (${percentChange > 0 ? "+" : ""}${percentChange.toFixed(0)}%)`}
    </span>
  );
}

export default function Compare() {
  const [params, setParams] = useSearchParams();
  const idsParam = params.get("ids");
  const [reports, setReports] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [pickA, setPickA] = useState("");
  const [pickB, setPickB] = useState("");

  useEffect(() => {
    api.listReports().then(setReports).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!idsParam) return;
    const ids = idsParam.split(",").map(Number);
    api.compare(ids).then(setData).catch((e) => setError(e.message));
  }, [idsParam]);

  const reportById = Object.fromEntries(reports.map((r) => [r.id, r]));

  if (error) return <div className="page"><div className="error-banner">{error}</div></div>;

  if (!idsParam) {
    return (
      <div className="page">
        <div className="page-header"><h1>Compare reports</h1></div>
        <div className="card card-pad">
          <div className="field-row">
            <div className="field">
              <label>First report</label>
              <select value={pickA} onChange={(e) => setPickA(e.target.value)}>
                <option value="">Select…</option>
                {reports.map((r) => <option key={r.id} value={r.id}>{formatDate(r.collected_on)}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Second report</label>
              <select value={pickB} onChange={(e) => setPickB(e.target.value)}>
                <option value="">Select…</option>
                {reports.map((r) => <option key={r.id} value={r.id}>{formatDate(r.collected_on)}</option>)}
              </select>
            </div>
          </div>
          <button
            className="btn btn-primary btn-sm"
            disabled={!pickA || !pickB || pickA === pickB}
            onClick={() => setParams({ ids: `${pickA},${pickB}` })}
          >
            Compare
          </button>
        </div>
      </div>
    );
  }

  if (!data) return <div className="page"><span className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Comparing {data.report_ids.length} reports</h1>
          <div className="page-subtitle">
            {data.report_ids.map((id) => formatDate(reportById[id]?.collected_on)).join("  →  ")}
          </div>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Analyte</th>
              {data.report_ids.map((id) => (
                <th key={id}>{formatDate(reportById[id]?.collected_on)}</th>
              ))}
              {data.report_ids.length === 2 && <th>Change</th>}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.analyte_name}>
                <td>{row.analyte_name}</td>
                {data.report_ids.map((id) => {
                  const v = row.values[id];
                  return (
                    <td key={id} className="num">
                      {v ? (
                        <>
                          {formatValue(v)} {v.unit}{" "}
                          <FlagBadge flag={v.flag} />
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  );
                })}
                {data.report_ids.length === 2 && (
                  <td><DeltaCell delta={row.delta} percentChange={row.percent_change} /></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
