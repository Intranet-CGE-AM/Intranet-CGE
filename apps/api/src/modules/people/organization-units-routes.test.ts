import type { AuthenticatedUser, LoginRequest } from "@cge/contracts";
import { describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import type { AppConfig } from "../../config.js";
import type { Database } from "../../db/client.js";
import type { AuthenticationService } from "../auth/service.js";
import type { PeopleService } from "../people/service.js";
import type { AccessService } from "../access/service.js";
import type { ObjectStorage } from "../storage/object-storage.js";

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
  async listAccounts() {
    return [];
  },
  async listAccountCandidates() {
    return [];
  },
  async resetPassword() {
    return true;
  },
  async deactivateAccount() {
    return true;
  },
  async deactivateAccountForPerson() {},
};

function withPermissions(
  permissions: AuthenticatedUser["permissions"],
): AuthenticationService {
  const scopedUser: AuthenticatedUser = { ...user, permissions };
  return {
    ...authenticationService,
    async authenticate(token: string) {
      return token === "valid-token" ? scopedUser : null;
    },
    async login(input: LoginRequest) {
      return input.password === "correct-password"
        ? { token: "valid-token", user: scopedUser }
        : null;
    },
  };
}

async function listUnitsAs(permissions: AuthenticatedUser["permissions"]) {
  const app = await buildApp({
    accessService: {} as AccessService,
    authenticationService: withPermissions(permissions),
    config,
    db: {} as Database,
    peopleService: {
      listUnits: async () => [],
    } as unknown as PeopleService,
    objectStorage: {} as ObjectStorage,
    readinessCheck: async () => undefined,
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: { origin: config.WEB_ORIGIN },
    payload: { email: user.account.email, password: "correct-password" },
  });
  const setCookie = login.headers["set-cookie"];
  const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)!.split(
    ";",
  )[0];
  const response = await app.inject({
    method: "GET",
    url: "/api/organization-units",
    headers: { cookie },
  });
  await app.close();
  return response;
}

describe("organization units route", () => {
  it("lets an account with only assets.read list units", async () => {
    const response = await listUnitsAs([
      { effect: "allow", key: "assets.read", unitId: null },
    ]);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ units: [] });
  });

  it("denies an account without people or assets read access", async () => {
    const response = await listUnitsAs([
      { effect: "allow", key: "tickets.create", unitId: null },
    ]);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "FORBIDDEN" });
  });
});
