// Test-only executable. Never imported by the application or included in its build.
import { randomUUID } from "node:crypto";
import { hash } from "argon2";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createDatabase } from "../src/db/client.js";
import { AccessService } from "../src/modules/access/service.js";
import { permissionOverrides } from "../src/modules/access/schema.js";
import { recordAudit } from "../src/modules/audit/service.js";
import { userAccounts } from "../src/modules/auth/schema.js";
import { LocalAuthenticationService } from "../src/modules/auth/service.js";
import type { Directory } from "../src/modules/auth/directory.js";
import { people } from "../src/modules/people/schema.js";
import { PeopleService } from "../src/modules/people/service.js";

if (process.env.NODE_ENV !== "test")
  throw new Error("Test environment required");
const name = `intranet_cge_ad_test_browser_${process.pid}`;
const owner = postgres("postgresql://cge:cge@127.0.0.1:5432/postgres");
await owner.unsafe(`CREATE DATABASE ${name}`);
const { db, client } = createDatabase(
  `postgresql://cge:cge@127.0.0.1:5432/${name}`,
);
await migrate(db, { migrationsFolder: "apps/api/drizzle" });
const personId = randomUUID(),
  adminPersonId = randomUUID(),
  adminId = randomUUID();
await db.insert(people).values([
  { id: personId, fullName: "Pessoa piloto AD" },
  { id: adminPersonId, fullName: "Administrador teste AD" },
]);
await db.insert(userAccounts).values({
  id: adminId,
  personId: adminPersonId,
  email: "admin@local.invalid",
  passwordHash: await hash("Browser-Local-Password-123"),
});
await db.insert(permissionOverrides).values({
  accountId: adminId,
  permission: "accounts.manage",
  effect: "allow",
});
const identity = {
  guid: randomUUID(),
  dn: "CN=Pilot,OU=Test",
  upn: "pilot@cge.lan",
  samAccountName: "pilot",
  displayName: "Pessoa piloto AD",
  email: null,
  eligible: true,
};
const directory: Directory = {
  id: "cge.lan",
  recheckSeconds: 300,
  async findByLogin(login) {
    return [identity.upn, identity.samAccountName].includes(login)
      ? identity
      : null;
  },
  async findByGuid(guid) {
    return guid === identity.guid ? identity : null;
  },
  async verifyPassword(_identity, password) {
    return password === "Browser-AD-Password-123";
  },
};
const access = new AccessService(db);
const authentication = new LocalAuthenticationService(
  db,
  12,
  (id) => access.resolvePermissions(id),
  (event) => recordAudit(db, event),
  directory,
);
const app = await buildApp({
  config: loadConfig({ NODE_ENV: "test", WEB_ORIGIN: "http://127.0.0.1:4174" }),
  db,
  directory,
  accessService: access,
  authenticationService: authentication,
  peopleService: new PeopleService(db),
  readinessCheck: async () => undefined,
});
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await app.close();
  await client.end();
  await owner.unsafe(`DROP DATABASE ${name} WITH (FORCE)`);
  await owner.end();
};
process.on("SIGTERM", () => void stop());
process.on("SIGINT", () => void stop());
await app.listen({ host: "127.0.0.1", port: 3102 });
