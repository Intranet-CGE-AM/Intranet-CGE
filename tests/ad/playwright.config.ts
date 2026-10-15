import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  workers: 1,
  timeout: 60000,
  reporter: "list",
  outputDir: "../../test-results/ad",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4174",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    contextOptions: { reducedMotion: "reduce" },
  },
  webServer: [
    {
      command:
        "NODE_ENV=test pnpm exec tsx apps/api/tests/ad-browser-server.ts",
      cwd: "../..",
      url: "http://127.0.0.1:3102/readyz",
      timeout: 60000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 10000 },
    },
    {
      command:
        "VITE_API_PROXY_TARGET=http://127.0.0.1:3102 pnpm --filter @cge/web exec vite --host 127.0.0.1 --port 4174",
      cwd: "../..",
      url: "http://127.0.0.1:4174/login",
      timeout: 60000,
    },
  ],
});
