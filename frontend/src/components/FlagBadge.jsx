import { flagClass, flagLabel } from "../utils";

export default function FlagBadge({ flag }) {
  const label = flagLabel(flag);
  if (!label) return null;
  return <span className={`flag-badge ${flagClass(flag)}`}>{label}</span>;
}
