import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate } from "../utils";

// Colors are passed straight through as CSS var() references (not resolved
// hex), the same way plain CSS would - so a chart already on screen
// re-colors immediately when the color theme or light/dark mode changes,
// with no re-render plumbing needed.
const C = {
  line: "var(--data-neutral)",
  high: "var(--critical)",
  low: "var(--serious)",
  grid: "var(--hairline)",
  axis: "var(--text-muted)",
  band: "var(--data-band)",
  surface: "var(--surface)",
};

function dotColor(flag) {
  if (flag === "H") return C.high;
  if (flag === "L") return C.low;
  return C.line;
}

function makeDot(radius) {
  return function Dot(props) {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    return <circle cx={cx} cy={cy} r={radius} fill={dotColor(payload.flag)} stroke={C.surface} strokeWidth={1.5} />;
  };
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="card card-pad" style={{ fontSize: 12.5 }}>
      <div style={{ fontWeight: 600 }}>{formatDate(p.collected_on)}</div>
      <div className="num" style={{ marginTop: 2 }}>
        {p.comparator || ""}
        {p.value_numeric} {p.unit}
        {p.flag && <span style={{ color: dotColor(p.flag), marginLeft: 6, fontWeight: 700 }}>{p.flag}</span>}
      </div>
      {(p.ref_low != null || p.ref_high != null) && (
        <div className="muted">Ref: {p.ref_low ?? "–"} to {p.ref_high ?? "–"}</div>
      )}
    </div>
  );
}

export default function TrendChart({ points, compact = false, height }) {
  const data = points.map((p) => ({ ...p, x: formatDate(p.collected_on) }));
  const latest = points[points.length - 1];
  const hasBand = latest && (latest.ref_low != null || latest.ref_high != null);

  const values = data.map((d) => d.value_numeric).filter((v) => v != null);
  const allValues = [...values, latest?.ref_low, latest?.ref_high].filter((v) => v != null);
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);
  const pad = Math.max((dataMax - dataMin) * 0.15, dataMax * 0.05, 1);
  const domain = [dataMin - pad, dataMax + pad];
  const bandLow = latest?.ref_low ?? domain[0];
  const bandHigh = latest?.ref_high ?? domain[1];

  return (
    <div style={{ width: "100%", height: height ?? (compact ? 96 : 280) }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={compact ? { top: 4, right: 4, left: 4, bottom: 0 } : { top: 12, right: 20, left: 0, bottom: 4 }}>
          {!compact && <CartesianGrid stroke={C.grid} vertical={false} />}
          <XAxis
            dataKey="x"
            tick={compact ? false : { fontSize: 11, fill: C.axis }}
            tickLine={false}
            axisLine={compact ? false : { stroke: C.grid }}
            height={compact ? 4 : undefined}
          />
          <YAxis hide={compact} tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={false} width={compact ? 0 : 40} domain={domain} />
          <Tooltip content={<CustomTooltip />} />
          {hasBand && <ReferenceArea y1={bandLow} y2={bandHigh} fill={C.band} stroke="none" />}
          <Line
            type="monotone"
            dataKey="value_numeric"
            stroke={C.line}
            strokeWidth={compact ? 1.75 : 2}
            dot={makeDot(compact ? 3 : 4)}
            activeDot={{ r: compact ? 4 : 6 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
