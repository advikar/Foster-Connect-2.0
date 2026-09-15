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

export default defineConfig(() => ({
  base: process.env.VITE_BASE || "/",
  plugins: [react(), tailwindcss(), previewNoIndex],
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
