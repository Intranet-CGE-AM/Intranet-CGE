import { describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import type { AppConfig } from "../../config.js";
import type { VisitConfirmationService } from "./confirmation-services.js";

const config: AppConfig = {
  NODE_ENV: "test",
  API_PORT: 3000,
  WEB_ORIGIN: "http://localhost:5173",
  DATABASE_URL: "postgresql://unused",
  SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
  SESSION_TTL_HOURS: 12,
  SECURE_COOKIES: false,
  OBJECT_STORAGE_ENDPOINT: "http://localhost:9000",
  OBJECT_STORAGE_ACCESS_KEY: "test-key",
  OBJECT_STORAGE_SECRET_KEY: "test-secret",
  OBJECT_STORAGE_BUCKET: "test-bucket",
};

const publicVisit = { visitor: { fullName: "Maria" }, status: "pending" };

const confirmationService = {
  getPublic: async (token: string) => {
    expect(token).toBe("abc123");
    return publicVisit;
  },
} as unknown as VisitConfirmationService;

describe("visit confirmation routes", () => {
  it("serves the public confirmation lookup without authentication", async () => {
    const app = await buildApp({
      config,
      readinessCheck: async () => undefined,
      visitConfirmationService: confirmationService,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/public/visit-confirmations/abc123",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(publicVisit);
    await app.close();
  });
});
