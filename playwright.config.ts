import { defineConfig, devices } from "@playwright/test";

const databaseUrl = "postgresql://cge:cge@127.0.0.1:5432/intranet_cge_e2e";
const sessionSecret = "e2e-session-secret-at-least-32-characters";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: [
        "NODE_ENV=test",
        "API_PORT=3101",
        "WEB_ORIGIN=http://127.0.0.1:4173",
        `DATABASE_URL=${databaseUrl}`,
        `SESSION_SECRET=${sessionSecret}`,
        "pnpm --filter @cge/api exec tsx src/server.ts",
      ].join(" "),
      url: "http://127.0.0.1:3101/readyz",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command:
        "VITE_API_PROXY_TARGET=http://127.0.0.1:3101 pnpm --filter @cge/web exec vite --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173/login",
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
