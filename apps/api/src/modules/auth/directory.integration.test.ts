import { randomUUID } from "node:crypto";
import { hash } from "argon2";
import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { buildApp } from "../../app.js";
import { loadConfig } from "../../config.js";
import { createDatabase } from "../../db/client.js";
import { permissionOverrides } from "../access/schema.js";
import { AccessService } from "../access/service.js";
import { recordAudit } from "../audit/service.js";
import { PeopleService } from "../people/service.js";
import { people } from "../people/schema.js";
import { directoryUnavailable, type DirectoryIdentity } from "./directory.js";
import { sessions, userAccounts } from "./schema.js";
import { LocalAuthenticationService } from "./service.js";

const url = process.env.CGE_AUTH_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite("AD account and session integration (isolated PostgreSQL)", () => {
  const { db, client } = createDatabase(url ?? "postgresql://unused");
  const access = new AccessService(db);
  let app: Awaited<ReturnType<typeof buildApp>>;
  let service: LocalAuthenticationService;
  let adminId: string, personId: string, cookie: string, localHash: string;
  let identity: DirectoryIdentity;
  const directory = {
    id: "cge.lan",
    recheckSeconds: 300,
    findByLogin: vi.fn(),
    findByGuid: vi.fn(),
    verifyPassword: vi.fn(),
  };
  const origin = "http://localhost:4174";
  const headers = () => ({ origin, cookie, "x-forwarded-for": randomUUID() });
  beforeAll(async () => {
    const target = new URL(url!);
    if (
      !["127.0.0.1", "localhost"].includes(target.hostname) ||
      !target.pathname.startsWith("/intranet_cge_ad_test")
    )
      throw new Error("Use an isolated local AD test database");
    localHash = await hash("Local-Password-123");
    service = new LocalAuthenticationService(
      db,
      12,
      (id) => access.resolvePermissions(id),
      (event) => recordAudit(db, event),
      directory,
    );
    app = await buildApp({
      config: loadConfig({ NODE_ENV: "test", WEB_ORIGIN: origin }),
      db,
      accessService: access,
      peopleService: new PeopleService(db),
      authenticationService: service,
      directory,
      readinessCheck: async () => undefined,
    });
  });
  beforeEach(async () => {
    identity = {
      guid: randomUUID(),
      dn: "CN=AD Test,OU=CGE,DC=cge,DC=lan",
      upn: `ad-${randomUUID()}@cge.lan`,
      samAccountName: `ad-${randomUUID()}`,
      displayName: "AD Test",
      email: null,
      eligible: true,
    };
    directory.findByLogin
      .mockReset()
      .mockImplementation(async (login: string) =>
        [
          identity.upn,
          identity.samAccountName,
          `srv-cgead2\\${identity.samAccountName}`,
        ].includes(login)
          ? identity
          : null,
      );
    directory.findByGuid
      .mockReset()
      .mockImplementation(async (guid: string) =>
        guid === identity.guid ? identity : null,
      );
    directory.verifyPassword
      .mockReset()
      .mockImplementation(
        async (_identity, password) => password === "Corporate-Password-123",
      );
    const adminPerson = randomUUID();
    personId = randomUUID();
    adminId = randomUUID();
    await db.insert(people).values([
      { id: adminPerson, fullName: "AD test administrator" },
      { id: personId, fullName: "AD test person" },
    ]);
    const email = `${adminId}@local.invalid`;
    await db.insert(userAccounts).values({
      id: adminId,
      personId: adminPerson,
      email,
      passwordHash: localHash,
    });
    await db.insert(permissionOverrides).values(
      ["accounts.manage", "audit.read"].map((permission) => ({
        accountId: adminId,
        permission,
        effect: "allow",
      })),
    );
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin, "x-forwarded-for": randomUUID() },
      payload: { email, password: "Local-Password-123" },
    });
    expect(login.statusCode).toBe(200);
    cookie = String(login.headers["set-cookie"]).split(";")[0]!;
  });
  afterAll(async () => {
    await app?.close();
    await client.end();
  });
  const link = (overrides = {}) =>
    app.inject({
      method: "POST",
      url: "/api/admin/directory/link",
      headers: headers(),
      payload: {
        identifier: identity.upn,
        expectedGuid: identity.guid,
        personId,
        ...overrides,
      },
    });
  const login = (
    identifier = identity.upn,
    password = "Corporate-Password-123",
    ip = randomUUID(),
  ) => service.login({ identifier, password }, ip);

  it("links a person without email, authenticates and preserves an identifiable audit actor", async () => {
    const response = await link();
    expect(response.statusCode).toBe(200);
    const result = await login();
    expect(result?.user.account).toMatchObject({
      email: null,
      authProvider: "ad",
      directoryUsername: identity.upn,
      mustChangePassword: false,
    });
    expect(result?.user.permissions).toEqual([]);
    const audit = await app.inject({
      method: "GET",
      url: "/api/audit-events",
      headers: headers(),
    });
    expect(audit.statusCode).toBe(200);
    expect(
      audit
        .json()
        .events.some(
          (event: { actor?: { accountId: string; email: string | null } }) =>
            event.actor?.accountId === response.json().id &&
            event.actor?.email === null,
        ),
    ).toBe(true);
  });
  it("does not authenticate or provision an unlinked AD user", async () => {
    expect(await login()).toBeNull();
    expect(directory.verifyPassword).not.toHaveBeenCalled();
    expect(
      await db
        .select()
        .from(userAccounts)
        .where(eq(userAccounts.personId, personId)),
    ).toHaveLength(0);
  });
  it("converts in place, keeps permissions, removes the local password and revokes old sessions", async () => {
    const accountId = randomUUID();
    const email = `${accountId}@local.invalid`;
    await db
      .insert(userAccounts)
      .values({ id: accountId, personId, email, passwordHash: localHash });
    await db
      .insert(permissionOverrides)
      .values({ accountId, permission: "people.read", effect: "allow" });
    const prior = await service.login({
      email,
      password: "Local-Password-123",
    });
    expect(prior).not.toBeNull();
    expect((await link()).json().id).toBe(accountId);
    expect(await service.authenticate(prior!.token)).toBeNull();
    expect(await login(email, "Local-Password-123")).toBeNull();
    expect(await login(identity.upn, "Local-Password-123")).toBeNull();
    const [account] = await db
      .select()
      .from(userAccounts)
      .where(eq(userAccounts.id, accountId));
    expect(account?.passwordHash).toBeNull();
    expect((await login())?.user.permissions).toContainEqual({
      key: "people.read",
      unitId: null,
      effect: "allow",
    });
    await expect(
      service.resetPassword(
        accountId,
        { temporaryPassword: "Replacement-Password-123" },
        adminId,
      ),
    ).rejects.toMatchObject({ code: "DIRECTORY_PASSWORD_MANAGED" });
    await expect(
      service.changePassword(accountId, {
        currentPassword: "Corporate-Password-123",
        newPassword: "Replacement-Password-123",
      }),
    ).rejects.toMatchObject({ code: "DIRECTORY_PASSWORD_MANAGED" });
  });
  it("rejects wrong identity confirmation, duplicate links and non-admin callers", async () => {
    expect((await link({ expectedGuid: randomUUID() })).statusCode).toBe(409);
    expect((await link()).statusCode).toBe(200);
    const otherPerson = randomUUID();
    await db
      .insert(people)
      .values({ id: otherPerson, fullName: "Another person" });
    expect((await link({ personId: otherPerson })).statusCode).toBe(409);
    const result = await login();
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/directory/lookup",
      headers: {
        origin,
        cookie: `cge_session=${app.signCookie(result!.token)}`,
      },
      payload: { identifier: identity.upn },
    });
    expect(response.statusCode).toBe(403);
  });
  it("revalidates by GUID after rename and rejects a recreated object with the same login", async () => {
    await link();
    identity.upn = `renamed-${randomUUID()}@cge.lan`;
    identity.samAccountName = `renamed-${randomUUID()}`;
    expect((await login())?.user.account.directoryUsername).toBe(identity.upn);
    identity.guid = randomUUID();
    expect(await login()).toBeNull();
  });
  it("shares the attempt limit across UPN, short name and domain-prefixed aliases", async () => {
    await link();
    const ip = randomUUID();
    for (let i = 0; i < 5; i++)
      expect(
        await login(
          i % 2 ? identity.samAccountName : identity.upn,
          "wrong",
          ip,
        ),
      ).toBeNull();
    await expect(
      login(`srv-cgead2\\${identity.samAccountName}`, "wrong", ip),
    ).rejects.toMatchObject({ statusCode: 429 });
    expect(directory.verifyPassword).toHaveBeenCalledTimes(5);
  });
  it("revokes every session when directory eligibility is removed", async () => {
    const linked = await link();
    const first = await login();
    const second = await login();
    identity.eligible = false;
    await db
      .update(userAccounts)
      .set({ directoryCheckedAt: new Date(0) })
      .where(eq(userAccounts.id, linked.json().id));
    expect(await service.authenticate(first!.token)).toBeNull();
    expect(await service.authenticate(second!.token)).toBeNull();
    expect(
      await db
        .select()
        .from(sessions)
        .where(eq(sessions.accountId, linked.json().id)),
    ).toHaveLength(0);
  });
  it("fails closed on an AD outage and keeps the local recovery account usable", async () => {
    const linked = await link();
    const result = await login();
    await db
      .update(userAccounts)
      .set({ directoryCheckedAt: new Date(0) })
      .where(eq(userAccounts.id, linked.json().id));
    directory.findByGuid.mockRejectedValue(directoryUnavailable());
    await expect(service.authenticate(result!.token)).rejects.toMatchObject({
      statusCode: 503,
    });
    await expect(login()).rejects.toMatchObject({ statusCode: 503 });
    const [admin] = await db
      .select()
      .from(userAccounts)
      .where(eq(userAccounts.id, adminId));
    expect(
      await service.login({
        email: admin!.email!,
        password: "Local-Password-123",
      }),
    ).not.toBeNull();
  });
  it("denies locally disabled accounts and self conversion", async () => {
    const [admin] = await db
      .select()
      .from(userAccounts)
      .where(eq(userAccounts.id, adminId));
    expect((await link({ personId: admin!.personId })).statusCode).toBe(409);
    const linked = await link();
    await service.deactivateAccount(linked.json().id, adminId);
    expect(await login()).toBeNull();
  });
});
