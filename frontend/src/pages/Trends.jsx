import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { analyteDescription } from "../analyteInfo";
import FlagBadge from "../components/FlagBadge";
import Sparkline from "../components/Sparkline";
import TrendChart from "../components/TrendChart";
import { formatDate, formatValue, refRangeLabel } from "../utils";

function readStoredView() {
  try {
    return localStorage.getItem("myhemogram.trendsView") || "grid";
  } catch {
    return "grid";
  }
}

function AnalyteCard({ analyte, points, onOpen }) {
  return (
    <button className="analyte-card" onClick={onOpen}>
      <div className="analyte-card-head">
        <h3>{analyte.analyte_name}</h3>
        <FlagBadge flag={analyte.latest_flag} />
      </div>
      <p className="desc">{analyteDescription(analyte.analyte_name)}</p>

      {points.length >= 2 ? (
        <TrendChart points={points} compact />
      ) : (
        <div className="no-data">Only one test on file so far</div>
      )}

      <div className="value-row">
        <span className="value">
          {analyte.latest_value_text}
          {analyte.unit && <span className="unit">{analyte.unit}</span>}
        </span>
        <span className="meta">
          {analyte.point_count} test{analyte.point_count === 1 ? "" : "s"}
        </span>
      </div>
    </button>
  );
}

export default function Trends() {
  const [analytes, setAnalytes] = useState(null);
  const [trends, setTrends] = useState({});
  const [search, setSearch] = useState("");
  const [view, setView] = useState(readStoredView);
  const [params, setParams] = useSearchParams();
  const selected = params.get("analyte");
  const [selectedTrend, setSelectedTrend] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem("myhemogram.trendsView", view);
    } catch {
      // ignore (private browsing, storage disabled, etc.)
    }
  }, [view]);

  useEffect(() => {
    api.listAnalytes().then(setAnalytes).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!analytes) return;
    Promise.all(analytes.map((a) => api.analyteTrend(a.analyte_name))).then((results) => {
      const map = {};
      results.forEach((t) => (map[t.analyte_name] = t.points));
      setTrends(map);
      if (!selected && analytes.length) {
        setParams({ analyte: analytes[0].analyte_name }, { replace: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analytes]);

  useEffect(() => {
    if (!selected) return;
    api.analyteTrend(selected).then(setSelectedTrend).catch((e) => setError(e.message));
  }, [selected]);

  const filtered = useMemo(() => {
    if (!analytes) return [];
    const q = search.trim().toLowerCase();
    if (!q) return analytes;
    return analytes.filter((a) => a.analyte_name.toLowerCase().includes(q));
  }, [analytes, search]);

  function openInList(name) {
    setView("list");
    setParams({ analyte: name });
  }

  if (error) return <div className="page"><div className="error-banner">{error}</div></div>;
  if (!analytes) return <div className="page"><span className="spinner" /></div>;
  if (analytes.length === 0) {
    return (
      <div className="page">
        <div className="card"><div className="empty-state">No results tracked yet. Import a report to see trends.</div></div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Lifetime trends</h1>
          <div className="page-subtitle">{analytes.length} analytes tracked</div>
        </div>
        <div className="toolbar">
          <input
            placeholder="Search analytes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 200 }}
          />
          <div className="view-toggle">
            <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>Grid</button>
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>List</button>
          </div>
        </div>
      </div>

      {view === "grid" ? (
        <div className="analyte-grid">
          {filtered.map((a) => (
            <AnalyteCard
              key={a.analyte_name}
              analyte={a}
              points={trends[a.analyte_name] || []}
              onOpen={() => openInList(a.analyte_name)}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>
          <div className="card">
            <div style={{ maxHeight: 620, overflowY: "auto" }}>
              <table>
                <tbody>
                  {filtered.map((a) => (
                    <tr
                      key={a.analyte_name}
                      onClick={() => setParams({ analyte: a.analyte_name })}
                      style={{ cursor: "pointer", background: a.analyte_name === selected ? "var(--accent-soft)" : undefined }}
                    >
                      <td>
                        <div style={{ fontWeight: 500 }}>{a.analyte_name}</div>
                        <div className="muted" style={{ fontSize: 11 }}>{a.point_count} test{a.point_count === 1 ? "" : "s"}</div>
                      </td>
                      <td>
                        <div className="sparkline-cell">
                          <Sparkline points={trends[a.analyte_name] || []} />
                          <div>
                            <div className="num" style={{ fontSize: 12.5 }}>{a.latest_value_text}</div>
                            <FlagBadge flag={a.latest_flag} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            {selectedTrend && (
              <div className="card card-pad">
                <div className="page-header" style={{ marginBottom: 8 }}>
                  <div>
                    <h2>{selectedTrend.analyte_name}</h2>
                    <div className="page-subtitle">{analyteDescription(selectedTrend.analyte_name)}</div>
                  </div>
                </div>

                {selectedTrend.points.length >= 2 ? (
                  <TrendChart points={selectedTrend.points} />
                ) : (
                  <div className="muted" style={{ padding: "24px 0" }}>
                    Need at least two tests with this analyte to draw a trend line.
                  </div>
                )}

                <table style={{ marginTop: 16 }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Value</th>
                      <th>Reference range</th>
                      <th>Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...selectedTrend.points].reverse().map((p) => (
                      <tr key={p.report_id}>
                        <td>{formatDate(p.collected_on)}</td>
                        <td className="num">{formatValue(p)} {p.unit}</td>
                        <td className="secondary-text">{refRangeLabel(p)}</td>
                        <td><FlagBadge flag={p.flag} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
