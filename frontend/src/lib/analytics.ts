/**
 * Privacy-preserving page-view counting with GoatCounter
 * (https://www.goatcounter.com), using its documented pixel endpoint
 * (https://www.goatcounter.com/help/pixel) rather than count.js. The script
 * would also send the raw query string, and on this site the query carries
 * what a person searched for; building the request ourselves means exactly
 * these fields leave the device and nothing else:
 *
 *   p  the path (no query string, no title)
 *   r  the referring site as the browser exposes it (strict-origin policy)
 *   s  screen size, so layouts can be checked against real devices
 *
 * No cookies, no identifiers. Partner pages are never counted, Do Not Track is
 * honored, and nothing is sent outside production builds or from localhost.
 * Called from the youth layout whenever the path changes (single-page app).
 */

const SITE_ENDPOINT = "https://fosterguide.goatcounter.com/count";

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
  if (pathname.startsWith("/partners")) return;
  const params = new URLSearchParams({
    p: pathname,
    r: document.referrer,
    s: `${window.screen.width},${window.screen.height},${window.devicePixelRatio || 1}`,
    rnd: Date.now().toString(36), // cache buster only; GoatCounter ignores it
  });
  // A GET for a 1×1 GIF, as the pixel documentation describes; best-effort.
  const pixel = new Image();
  pixel.src = `${SITE_ENDPOINT}?${params.toString()}`;
}
