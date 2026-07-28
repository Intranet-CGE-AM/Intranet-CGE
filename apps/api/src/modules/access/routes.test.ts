import type { AuthenticatedUser, LoginRequest } from "@cge/contracts";
import { describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import type { AppConfig } from "../../config.js";
import type { Database } from "../../db/client.js";
import type { AuthenticationService } from "../auth/service.js";
import type { AccessService } from "./service.js";

const config: AppConfig = {
  NODE_ENV: "test",
  API_PORT: 3000,
  WEB_ORIGIN: "http://localhost:5173",
  DATABASE_URL: "postgresql://unused",
  SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
  SESSION_TTL_HOURS: 12,
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
  },
  employment: null,
  permissions: [],
};

const authenticationService: AuthenticationService = {
  async createAccount() {
    return { id: user.account.id, email: user.account.email };
  },
  async authenticate(token: string) {
    return token === "valid-token" ? user : null;
  },
  async changePassword() {
    return "changed";
  },
  async login(input: LoginRequest) {
    return input.password === "correct-password"
      ? { token: "valid-token", user }
      : null;
  },
  async logout() {},
  async resetPassword() {
    return true;
  },
  async deactivateAccount() {
    return true;
  },
  async deactivateAccountForPerson() {},
};

describe("access routes", () => {
  it("denies an authenticated account without the global management grant", async () => {
    const accessService = {
      allows: async () => false,
    } as unknown as AccessService;
    const app = await buildApp({
      accessService,
      authenticationService,
      config,
      db: {} as Database,
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
    const setCookie = login.headers["set-cookie"];
    const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)!.split(
      ";",
    )[0];

    const response = await app.inject({
      method: "GET",
      url: "/api/admin/roles",
      headers: { cookie },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "FORBIDDEN" });
    await app.close();
  });
});
