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

const COLORS = {
  line: "#2a78d6",
  normal: "#2a78d6",
  high: "#d03b3b",
  low: "#ec835a",
  grid: "#e1e0d9",
  axis: "#898781",
  band: "rgba(42, 120, 214, 0.08)",
};

function dotColor(flag) {
  if (flag === "H") return COLORS.high;
  if (flag === "L") return COLORS.low;
  return COLORS.normal;
}

function CustomDot(props) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={4} fill={dotColor(payload.flag)} stroke="var(--surface)" strokeWidth={1.5} />;
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

export default function TrendChart({ points }) {
  const data = points.map((p) => ({ ...p, x: formatDate(p.collected_on) }));
  const latest = points[points.length - 1];
  const hasBand = latest && (latest.ref_low != null || latest.ref_high != null);

  // Reference ranges are often one-sided ("<46"). Compute an explicit y
  // domain from the data + whichever bound exists, so a one-sided band still
  // has something sensible to extend to instead of being invisible.
  const values = data.map((d) => d.value_numeric).filter((v) => v != null);
  const allValues = [...values, latest?.ref_low, latest?.ref_high].filter((v) => v != null);
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);
  const pad = Math.max((dataMax - dataMin) * 0.15, dataMax * 0.05, 1);
  const domain = [dataMin - pad, dataMax + pad];
  const bandLow = latest?.ref_low ?? domain[0];
  const bandHigh = latest?.ref_high ?? domain[1];

  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 12, right: 20, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={COLORS.grid} vertical={false} />
          <XAxis dataKey="x" tick={{ fontSize: 11, fill: COLORS.axis }} tickLine={false} axisLine={{ stroke: COLORS.grid }} />
          <YAxis tick={{ fontSize: 11, fill: COLORS.axis }} tickLine={false} axisLine={false} width={40} domain={domain} />
          <Tooltip content={<CustomTooltip />} />
          {hasBand && (
            <ReferenceArea y1={bandLow} y2={bandHigh} fill={COLORS.band} stroke="none" />
          )}
          <Line
            type="monotone"
            dataKey="value_numeric"
            stroke={COLORS.line}
            strokeWidth={2}
            dot={<CustomDot />}
            activeDot={{ r: 6 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
