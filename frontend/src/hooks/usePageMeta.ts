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
    document.title = title ? `${title} · ${SITE}` : `${SITE} — your guide for the next step`;
    setMeta("description", description);
    setMeta("og:title", document.title, "property");
    setMeta("og:description", description, "property");
    setMeta("og:url", `${ORIGIN}${path}`, "property");
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = `${ORIGIN}${path}`;
  }, [title, description, path]);
}

function setMeta(name: string, content: string, attribute: "name" | "property" = "name") {
  let tag = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
  if (!tag) { tag = document.createElement("meta"); tag.setAttribute(attribute, name); document.head.appendChild(tag); }
  tag.content = content;
}
