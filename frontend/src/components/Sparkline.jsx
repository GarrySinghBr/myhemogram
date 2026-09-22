import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";

export default function Sparkline({ points, color = "var(--data-neutral)" }) {
  const data = points.map((p, i) => ({ i, v: p.value_numeric }));
  if (data.filter((d) => d.v != null).length < 2) {
    return <div style={{ width: 64, height: 24 }} />;
  }
  return (
    <div style={{ width: 64, height: 24 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
