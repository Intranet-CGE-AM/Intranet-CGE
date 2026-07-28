import type { AuthenticatedUser, LoginRequest } from "@cge/contracts";
import { describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import type { AppConfig } from "../../config.js";
import type { AuthenticationService } from "./service.js";

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

const user: AuthenticatedUser = {
  account: {
    id: "00000000-0000-4000-8000-000000000001",
    email: "ana.silva@cge.am.gov.br",
    mustChangePassword: false,
  },
  person: {
    id: "00000000-0000-4000-8000-000000000002",
    displayName: "Ana Silva",
    avatarUrl: null,
  },
  employment: null,
  permissions: [],
};

class FakeAuthenticationService implements AuthenticationService {
  async createAccount() {
    return { id: user.account.id, email: user.account.email };
  }

  async authenticate(token: string) {
    return token === "valid-token" ? user : null;
  }

  async changePassword() {
    return "changed" as const;
  }

  async login(input: LoginRequest) {
    return input.password === "correct-password"
      ? { token: "valid-token", user }
      : null;
  }

  async logout() {}

  async listAccounts() {
    return [];
  }

  async resetPassword() {
    return true;
  }

  async deactivateAccount() {
    return true;
  }

  async deactivateAccountForPerson() {}
}

describe("authentication routes", () => {
  it("sets a protected session cookie and restores the user", async () => {
    const app = await buildApp({
      authenticationService: new FakeAuthenticationService(),
      config,
      readinessCheck: async () => undefined,
    });

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: config.WEB_ORIGIN },
      payload: {
        email: user.account.email,
        password: "correct-password",
      },
    });

    expect(login.statusCode).toBe(200);
    const cookie = login.headers["set-cookie"];
    const sessionCookie = Array.isArray(cookie) ? cookie[0] : cookie;
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("SameSite=Strict");

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: sessionCookie!.split(";")[0]! },
    });

    expect(me.statusCode).toBe(200);
    expect(me.json()).toEqual({ user });
    await app.close();
  });

  it("rejects unsafe requests from another origin", async () => {
    const app = await buildApp({
      authenticationService: new FakeAuthenticationService(),
      config,
      readinessCheck: async () => undefined,
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: "https://example.invalid" },
      payload: {
        email: user.account.email,
        password: "correct-password",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "INVALID_ORIGIN" });
    await app.close();
  });
});
