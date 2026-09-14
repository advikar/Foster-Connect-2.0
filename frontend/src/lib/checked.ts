/** "Checked Aug 2026", or "Needs re-check" past 180 days. */
export function describeChecked(verifiedAt: string): { label: string; stale: boolean; full: string } {
  const date = new Date(`${verifiedAt}T00:00:00`);
  if (Number.isNaN(date.getTime())) return { label: "Check date unknown", stale: true, full: "unknown" };
  const days = (Date.now() - date.getTime()) / 86_400_000;
  const full = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (days > 180) return { label: "Needs re-check", stale: true, full };
  return { label: `Checked ${date.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`, stale: false, full };
}
