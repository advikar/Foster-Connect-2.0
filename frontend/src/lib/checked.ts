/**
 * "Checked online Aug 2026" / "Checked by phone Aug 2026", or "Needs re-check"
 * past 180 days or once a reviewer's re-check date has arrived (P7). Saying
 * *how* it was checked matters: most listings were checked against the
 * program's own page, not by calling, and a young person deciding whether to
 * show up should know that.
 */
export function describeChecked(verifiedAt: string, how: "phone" | "online" = "online", recheckAt?: string | null): { label: string; stale: boolean; full: string; how: string } {
  const howText = how === "phone" ? "by phone" : "online";
  const date = new Date(`${verifiedAt}T00:00:00`);
  if (Number.isNaN(date.getTime())) return { label: "Check date unknown", stale: true, full: "unknown", how: howText };
  const days = (Date.now() - date.getTime()) / 86_400_000;
  const full = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const recheckDue = Boolean(recheckAt) && new Date(`${recheckAt}T00:00:00`).getTime() <= Date.now();
  if (days > 180 || recheckDue) return { label: "Needs re-check", stale: true, full, how: howText };
  return { label: `Checked ${howText} ${date.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`, stale: false, full, how: howText };
}
