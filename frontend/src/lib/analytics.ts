/**
 * Privacy-preserving page-view counting with GoatCounter
 * (https://www.goatcounter.com). No cookies, no identifiers, no personal data.
 *
 * What is sent per view: the path (never the query string, so search text and
 * `?listing=` ids stay on the device), the referrer's hostname as the browser
 * exposes it, screen size and user agent. Partner pages are never counted,
 * Do Not Track is honored, and nothing loads outside production builds.
 *
 * Because this is a single-page app the script is told not to count on load;
 * `trackPageView` is called from the youth layout whenever the path changes.
 */

const SITE_ENDPOINT = "https://fosterguide.goatcounter.com/count";
const SCRIPT_SRC = "https://gc.zgo.at/count.js";

type GoatCounter = {
  no_onload?: boolean;
  allow_local?: boolean;
  count?: (vars: { path: string; title?: string }) => void;
};

declare global {
  interface Window { goatcounter?: GoatCounter }
}

let loading: Promise<void> | null = null;

function enabled(): boolean {
  if (!import.meta.env.PROD) return false;
  if (typeof window === "undefined") return false;
  if (navigator.doNotTrack === "1") return false;
  return true;
}

function load(): Promise<void> {
  if (loading) return loading;
  loading = new Promise(resolve => {
    window.goatcounter = { no_onload: true, allow_local: false, ...window.goatcounter };
    const script = document.createElement("script");
    script.async = true;
    script.src = SCRIPT_SRC;
    script.dataset.goatcounter = SITE_ENDPOINT;
    script.onload = () => resolve();
    script.onerror = () => resolve(); // blocked by an extension or offline: counting is best-effort
    document.head.appendChild(script);
  });
  return loading;
}

/** Count one view of `pathname`. Safe to call on every route change. */
export function trackPageView(pathname: string): void {
  if (!enabled()) return;
  if (pathname.startsWith("/partners")) return;
  // Titles are not sent: the Ask and Roadmap pages set them from what the person typed.
  void load().then(() => window.goatcounter?.count?.({ path: pathname, title: "" }));
}
