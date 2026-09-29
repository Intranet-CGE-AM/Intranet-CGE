import { describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import type { AppConfig } from "../../config.js";
import {
  VisitConfirmationError,
  type VisitConfirmationService,
} from "./confirmation-services.js";

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

const invalidToken = () =>
  new VisitConfirmationError(
    "INVALID_CONFIRMATION_TOKEN",
    "Link de confirmação inválido.",
    404,
  );

const confirmationService = {
  getPublic: async (token: string) => {
    if (token !== "abc123") throw invalidToken();
    return publicVisit;
  },
  respond: async (token: string, input: { response: string }) => {
    if (token !== "abc123") throw invalidToken();
    return { ...publicVisit, status: input.response };
  },
} as unknown as VisitConfirmationService;

const build = () =>
  buildApp({
    config,
    readinessCheck: async () => undefined,
    visitConfirmationService: confirmationService,
  });

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

  it("rate limits the public lookup per client", async () => {
    const app = await buildApp({
      config,
      readinessCheck: async () => undefined,
      visitConfirmationService: confirmationService,
    });

    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const response = await app.inject({
        method: "GET",
        url: "/api/public/visit-confirmations/abc123",
      });
      statuses.push(response.statusCode);
    }

    expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
    await app.close();
  });

  it("rejects the lookup for an invalid token", async () => {
    const app = await build();

    const response = await app.inject({
      method: "GET",
      url: "/api/public/visit-confirmations/wrong",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      code: "INVALID_CONFIRMATION_TOKEN",
      message: "Link de confirmação inválido.",
    });
    await app.close();
  });

  it("accepts a response for a valid token from the web origin", async () => {
    const app = await build();

    const response = await app.inject({
      method: "POST",
      url: "/api/public/visit-confirmations/abc123",
      headers: { origin: config.WEB_ORIGIN },
      payload: { response: "confirmed" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "confirmed" });
    await app.close();
  });

  it("rejects a response for an invalid token", async () => {
    const app = await build();

    const response = await app.inject({
      method: "POST",
      url: "/api/public/visit-confirmations/wrong",
      headers: { origin: config.WEB_ORIGIN },
      payload: { response: "confirmed" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      code: "INVALID_CONFIRMATION_TOKEN",
    });
    await app.close();
  });
});
