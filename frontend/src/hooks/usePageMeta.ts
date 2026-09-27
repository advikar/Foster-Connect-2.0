import { useEffect } from "react";

const SITE = "Foster Guide";
const ORIGIN = "https://fosterguide.org";

/**
 * Per-route title, description and canonical (audit A17). Runs on the client;
 * GitHub Pages serves one HTML file, so this is what tabs, history and
 * link previews that execute scripts will see. The static index.html keeps
 * the site-wide defaults for crawlers that don't.
 */
export function usePageMeta(title: string, description: string, path: string) {
  useEffect(() => {
    current = { title, description, path };
    // An open listing owns the head until it closes, whichever effect ran last.
    if (!overlay) applyPageMeta(title, description, path);
  }, [title, description, path]);
}

export type PageMeta = { title: string; description: string; path: string };
/** The meta of the route underneath; an overlay (an open listing) restores it on close. */
let current: PageMeta | null = null;
let overlay: PageMeta | null = null;

/** Show an overlay's meta (an open listing) until the returned function is called, which restores the route's own. */
export function setOverlayMeta(meta: PageMeta) {
  overlay = meta;
  applyPageMeta(meta.title, meta.description, meta.path);
  return () => {
    if (overlay !== meta) return;
    overlay = null;
    if (current) applyPageMeta(current.title, current.description, current.path);
  };
}

/** Write title, description, og tags and canonical for one page. Same default as index.html's title. */
export function applyPageMeta(title: string, description: string, path: string) {
  document.title = title ? `${title} · ${SITE}` : `${SITE} — your guide to foster youth resources in the East Bay`;
  setMeta("description", description);
  setMeta("og:title", document.title, "property");
  setMeta("og:description", description, "property");
  setMeta("og:url", `${ORIGIN}${path}`, "property");
  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
  canonical.href = `${ORIGIN}${path}`;
}

function setMeta(name: string, content: string, attribute: "name" | "property" = "name") {
  let tag = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
  if (!tag) { tag = document.createElement("meta"); tag.setAttribute(attribute, name); document.head.appendChild(tag); }
  tag.content = content;
}
