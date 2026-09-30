import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const proxyTarget =
  process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": proxyTarget,
      "/healthz": proxyTarget,
      "/readyz": proxyTarget,
    },
  },
});
