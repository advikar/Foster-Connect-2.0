import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
// VITE_BASE is "/foster-connect/" for the GitHub Pages build (see
// .github/workflows/deploy-site.yml). VITE_PREVIEW marks a public preview:
// search engines are told not to index it until launch blockers are cleared.
const previewNoIndex = {
  name: "preview-noindex",
  transformIndexHtml: (html: string) => process.env.VITE_PREVIEW
    ? html.replace("<head>", '<head>\n    <meta name="robots" content="noindex, nofollow" />')
    : html,
};

// Audit A19: GitHub Pages sets no security headers, so the document carries
// them as meta tags on production builds only (the dev server injects inline
// scripts that a CSP would block). frame-ancestors cannot be expressed in a
// meta tag; that one needs a hosting move.
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
      "img-src 'self' data:",
      `connect-src 'self' ${api}`,
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");
    return html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />\n    <meta name="referrer" content="strict-origin-when-cross-origin" />`);
  },
};

export default defineConfig(() => ({
  base: process.env.VITE_BASE || "/",
  plugins: [react(), tailwindcss(), previewNoIndex, documentSecurity],
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
