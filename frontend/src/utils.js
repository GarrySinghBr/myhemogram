export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatValue(result) {
  if (!result) return "—";
  // value_text already carries any leading comparator (">=120.", "<46") when
  // it came off a parsed PDF, so don't double it up here.
  if (result.value_text) return result.value_text;
  const cmp = result.comparator || "";
  return `${cmp}${result.value_numeric ?? ""}`;
}

export function flagLabel(flag) {
  if (flag === "H") return "High";
  if (flag === "L") return "Low";
  return null;
}

export function flagClass(flag) {
  if (flag === "H") return "high";
  if (flag === "L") return "low";
  return "normal";
}

/** Position (0-100) of a value along [low, high], padded 20% either side so
 * points near/outside the reference band are still visible on the bar. */
export function rangePosition(value, low, high) {
  if (value == null || low == null || high == null || high <= low) return null;
  const span = high - low;
  const pad = span * 0.25;
  const min = low - pad;
  const max = high + pad;
  const pct = ((value - min) / (max - min)) * 100;
  return Math.max(2, Math.min(98, pct));
}

export function refRangeLabel(result) {
  if (!result) return "";
  if (result.ref_low != null && result.ref_high != null) {
    return `${result.ref_low} – ${result.ref_high}${result.unit ? " " + result.unit : ""}`;
  }
  if (result.ref_high != null) return `< ${result.ref_high} ${result.unit || ""}`;
  if (result.ref_low != null) return `> ${result.ref_low} ${result.unit || ""}`;
  return result.ref_range_text || "—";
}
