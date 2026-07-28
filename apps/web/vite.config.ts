import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000",
      "/healthz": process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000",
      "/readyz": process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000",
    },
  },
});
