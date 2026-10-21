import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
// VITE_BASE is "/" on Render (render.yaml). VITE_PREVIEW, when set, marks a
// throwaway preview build: search engines are told not to index it and the
// preview banner shows. Production builds do not set it (launch 2026-09-21).
const previewNoIndex = {
  name: "preview-noindex",
  transformIndexHtml: (html: string) => process.env.VITE_PREVIEW
    ? html.replace("<head>", '<head>\n    <meta name="robots" content="noindex, nofollow" />')
    : html,
};

// Audit A19: the document carries CSP and referrer meta tags on production
// builds as a fallback for any host that sends no headers (the dev server
// injects inline scripts that a CSP would block). On Render the same policy,
// plus frame-ancestors and HSTS, is sent as real headers (render.yaml).
const documentSecurity = {
  name: "document-security",
  apply: "build" as const,
  transformIndexHtml: (html: string) => {
    const api = process.env.VITE_API_URL || "http://localhost:4000";
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https://fosterguide.goatcounter.com",
      `connect-src 'self' ${api}`,
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");
    return html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />\n    <meta name="referrer" content="strict-origin-when-cross-origin" />`);
  },
};

// sitemap.xml is written at build time so every URL carries the date this
// build was published as lastmod (each deploy replaces the one HTML shell
// that serves all of these routes). Listings open at /resources?listing=ID
// and are not listed one by one. Keep this list in step with router.tsx.
const SITE_ORIGIN = "https://fosterguide.org";
const SITE_PATHS = ["/", "/resources", "/ask", "/roadmap", "/privacy", "/add-resource", "/partners"];
const sitemap = {
  name: "sitemap",
  apply: "build" as const,
  generateBundle() {
    const lastmod = new Date().toISOString().slice(0, 10);
    const urls = SITE_PATHS.map(p => `  <url><loc>${SITE_ORIGIN}${p}</loc><lastmod>${lastmod}</lastmod></url>`).join("\n");
    const source = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
    (this as { emitFile: (file: { type: "asset"; fileName: string; source: string }) => void }).emitFile({ type: "asset", fileName: "sitemap.xml", source });
  },
};

export default defineConfig(() => ({
  base: process.env.VITE_BASE || "/",
  plugins: [react(), tailwindcss(), previewNoIndex, documentSecurity, sitemap],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  css: {
    modules: {
      generateScopedName: "[name]_[local]_[hash:base64:5]",
    },
  },
}));
