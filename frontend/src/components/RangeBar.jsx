import { rangePosition, refRangeLabel } from "../utils";

export default function RangeBar({ result }) {
  const pos = rangePosition(result.value_numeric, result.ref_low, result.ref_high);
  const lowPct = rangePosition(result.ref_low, result.ref_low, result.ref_high);
  const highPct = rangePosition(result.ref_high, result.ref_low, result.ref_high);

  return (
    <div>
      <div className="range-bar">
        {lowPct != null && highPct != null && (
          <div
            className="fill-track"
            style={{ left: `${lowPct}%`, right: `${100 - highPct}%`, width: "auto" }}
          />
        )}
        {pos != null && <div className={`marker ${result.flag === "H" ? "high" : result.flag === "L" ? "low" : ""}`} style={{ left: `${pos}%` }} />}
      </div>
      <div className="range-text">{refRangeLabel(result)}</div>
    </div>
  );
}
