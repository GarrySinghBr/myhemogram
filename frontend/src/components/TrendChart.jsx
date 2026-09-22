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

function isDarkMode() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

function palette() {
  return isDarkMode()
    ? { line: "#a4a199", high: "#dd8a76", low: "#d9ab68", grid: "#37352f", axis: "#85827b", band: "rgba(164,161,153,0.10)" }
    : { line: "#6b6863", high: "#a83e2e", low: "#9c6425", grid: "#e4e1db", axis: "#8f8c86", band: "rgba(107,104,99,0.07)" };
}

function dotColor(flag, colors) {
  if (flag === "H") return colors.high;
  if (flag === "L") return colors.low;
  return colors.line;
}

function makeDot(colors, radius) {
  return function Dot(props) {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    return <circle cx={cx} cy={cy} r={radius} fill={dotColor(payload.flag, colors)} stroke="var(--surface)" strokeWidth={1.5} />;
  };
}

function CustomTooltip({ active, payload, colors }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="card card-pad" style={{ fontSize: 12.5 }}>
      <div style={{ fontWeight: 600 }}>{formatDate(p.collected_on)}</div>
      <div className="num" style={{ marginTop: 2 }}>
        {p.comparator || ""}
        {p.value_numeric} {p.unit}
        {p.flag && <span style={{ color: dotColor(p.flag, colors), marginLeft: 6, fontWeight: 700 }}>{p.flag}</span>}
      </div>
      {(p.ref_low != null || p.ref_high != null) && (
        <div className="muted">Ref: {p.ref_low ?? "–"} to {p.ref_high ?? "–"}</div>
      )}
    </div>
  );
}

export default function TrendChart({ points, compact = false, height }) {
  const colors = palette();
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
          {!compact && <CartesianGrid stroke={colors.grid} vertical={false} />}
          <XAxis
            dataKey="x"
            tick={compact ? false : { fontSize: 11, fill: colors.axis }}
            tickLine={false}
            axisLine={compact ? false : { stroke: colors.grid }}
            height={compact ? 4 : undefined}
          />
          <YAxis hide={compact} tick={{ fontSize: 11, fill: colors.axis }} tickLine={false} axisLine={false} width={compact ? 0 : 40} domain={domain} />
          <Tooltip content={<CustomTooltip colors={colors} />} />
          {hasBand && <ReferenceArea y1={bandLow} y2={bandHigh} fill={colors.band} stroke="none" />}
          <Line
            type="monotone"
            dataKey="value_numeric"
            stroke={colors.line}
            strokeWidth={compact ? 1.75 : 2}
            dot={makeDot(colors, compact ? 3 : 4)}
            activeDot={{ r: compact ? 4 : 6 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
