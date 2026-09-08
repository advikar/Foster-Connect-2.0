import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Temporary dev-only config: same as vite.config.ts but with a fresh cache
// dir, since the sandboxed shell can't delete the existing node_modules/.vite
// cache to re-optimize deps. Safe to remove any time.
export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  cacheDir: "node_modules/.vite-preview",
  server: {
    port: 5183,
    strictPort: true,
    host: true,
  },
  css: {
    modules: {
      generateScopedName: "[name]_[local]_[hash:base64:5]",
    },
  },
}));
