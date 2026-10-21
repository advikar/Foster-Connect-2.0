/**
 * Privacy-preserving page-view counting with GoatCounter
 * (https://www.goatcounter.com), using its documented pixel endpoint
 * (https://www.goatcounter.com/help/pixel) rather than count.js. The script
 * would also send the raw query string, and on this site the query carries
 * what a person searched for; building the request ourselves means exactly
 * these fields leave the device and nothing else:
 *
 *   p  the path (no query string)
 *   t  a fixed label for the route ("Find support"), never the document title,
 *      which on Ask and the plan page can contain what the person typed
 *   r  the referring site as the browser exposes it (strict-origin policy)
 *   s  screen size, so layouts can be checked against real devices
 *
 * No cookies, no identifiers. Do Not Track is honored, and nothing is sent
 * outside production builds or from localhost. Both layouts (youth and
 * partner) call this whenever the path changes (single-page app); partner
 * paths carry no account information, only the section name.
 */

const SITE_ENDPOINT = "https://fosterguide.goatcounter.com/count";

const LABELS: Record<string, string> = {
  "/": "Home",
  "/resources": "Find support",
  "/ask": "Ask Nova",
  "/roadmap": "Make a plan",
  "/saved": "Saved",
  "/add-resource": "Add a resource",
  "/privacy": "Privacy",
  "/partners": "Partners: landing",
  "/partners/sign-in": "Partners: sign in",
  "/partners/reset": "Partners: password reset",
  "/partners/overview": "Partners: overview",
  "/partners/submissions": "Partners: submissions",
  "/partners/add-resource": "Partners: add listing",
  "/partners/coverage": "Partners: coverage",
  "/partners/gaps": "Partners: gaps",
  "/partners/resources": "Partners: search listings",
  "/partners/review": "Partners: review queue",
  "/partners/guide": "Partners: guide",
  "/partners/accounts": "Partners: accounts",
};

/** Fixed, non-personal label for a route; unknown paths are the not-found page. */
export function routeLabel(pathname: string): string {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return LABELS[clean] ?? "Not found";
}

function enabled(): boolean {
  if (!import.meta.env.PROD) return false;
  if (typeof window === "undefined") return false;
  if (navigator.doNotTrack === "1") return false;
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return false;
  return true;
}

/** Count one view of `pathname`. Safe to call on every route change. */
export function trackPageView(pathname: string): void {
  if (!enabled()) return;
  const params = new URLSearchParams({
    p: pathname,
    t: routeLabel(pathname),
    r: document.referrer,
    s: `${window.screen.width},${window.screen.height},${window.devicePixelRatio || 1}`,
    rnd: Date.now().toString(36), // cache buster only; GoatCounter ignores it
  });
  // A GET for a 1×1 GIF, as the pixel documentation describes; best-effort.
  const pixel = new Image();
  pixel.src = `${SITE_ENDPOINT}?${params.toString()}`;
}
