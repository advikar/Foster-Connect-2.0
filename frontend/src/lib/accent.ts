/**
 * Accent colour (U1): "teal" (default) or "blue". `?accent=blue` in the URL
 * sets it for this browser; the footer toggle (preview builds) does the same.
 * Lives outside main.tsx so components can import it without re-running the
 * app entry under HMR.
 */
export const ACCENT_KEY = "fc-accent";
export type Accent = "teal" | "blue";

export function applyAccent(accent: string) {
  if (accent === "blue") document.documentElement.dataset.accent = "blue";
  else delete document.documentElement.dataset.accent;
  try { localStorage.setItem(ACCENT_KEY, accent === "blue" ? "blue" : "teal"); } catch { /* fine */ }
}

export function currentAccent(): Accent {
  return document.documentElement.dataset.accent === "blue" ? "blue" : "teal";
}

export function bootAccent() {
  const fromUrl = new URLSearchParams(window.location.search).get("accent");
  let stored = "";
  try { stored = localStorage.getItem(ACCENT_KEY) || ""; } catch { /* fine */ }
  const accent = fromUrl || stored;
  if (accent) applyAccent(accent);
}
