import { describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import type { AppConfig } from "./config.js";

const config: AppConfig = {
  NODE_ENV: "test",
  API_PORT: 3000,
  WEB_ORIGIN: "http://localhost:5173",
  DATABASE_URL: "postgresql://unused",
  SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
  SESSION_TTL_HOURS: 12,
  OBJECT_STORAGE_ENDPOINT: "http://localhost:9000",
  OBJECT_STORAGE_ACCESS_KEY: "test-key",
  OBJECT_STORAGE_SECRET_KEY: "test-secret",
  OBJECT_STORAGE_BUCKET: "test-bucket",
};

describe("system routes", () => {
  it("reports liveness and readiness", async () => {
    const app = await buildApp({
      config,
      readinessCheck: async () => undefined,
    });

    const health = await app.inject({ method: "GET", url: "/healthz" });
    const readiness = await app.inject({ method: "GET", url: "/readyz" });

    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok" });
    expect(readiness.statusCode).toBe(200);
    expect(readiness.json()).toEqual({ status: "ok" });

    await app.close();
  });

  it("reports an unavailable dependency", async () => {
    const app = await buildApp({
      config,
      readinessCheck: async () => {
        throw new Error("database unavailable");
      },
    });

    const readiness = await app.inject({ method: "GET", url: "/readyz" });

    expect(readiness.statusCode).toBe(503);
    expect(readiness.json()).toEqual({ status: "unavailable" });

    await app.close();
  });
});
