import { readFileSync } from "node:fs";
import { ActiveDirectory } from "./modules/auth/directory.js";
import "dotenv/config";

import { sql } from "drizzle-orm";

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./db/client.js";
import { AccessService } from "./modules/access/service.js";
import { recordAudit } from "./modules/audit/service.js";
import { LocalAuthenticationService } from "./modules/auth/service.js";
import { PeopleService } from "./modules/people/service.js";
import { MinioObjectStorage } from "./modules/storage/object-storage.js";
import { VacationService } from "./modules/vacations/service.js";
import { TicketService } from "./modules/tickets/service.js";
import { VisitConfirmationService } from "./modules/visits/confirmation-services.js";
import { VisitService } from "./modules/visits/service.js";
import { assetRoutes } from "./modules/assets/routes.js";
import { AssetService } from "./modules/assets/service.js";

const config = loadConfig();
const { client, db } = createDatabase(config.DATABASE_URL);
const accessService = new AccessService(db);
const peopleService = new PeopleService(db);
const objectStorage = new MinioObjectStorage(
  config.OBJECT_STORAGE_BUCKET,
  config.OBJECT_STORAGE_ENDPOINT,
  config.OBJECT_STORAGE_ACCESS_KEY,
  config.OBJECT_STORAGE_SECRET_KEY,
);
const vacationService = new VacationService(db);
const ticketService = new TicketService(db);
const visitService = new VisitService(db);
const visitConfirmationService = new VisitConfirmationService(db);
const ad = config.directory;
const directory = ad
  ? new ActiveDirectory({
      id: ad.AD_DOMAIN,
      url: ad.AD_URL,
      baseDN: ad.AD_BASE_DN,
      bindDN: ad.AD_BIND_DN,
      bindPassword: readFileSync(ad.AD_BIND_PASSWORD_FILE, "utf8").replace(
        /\r?\n$/,
        "",
      ),
      ca: readFileSync(ad.AD_CA_CERT_FILE, "utf8"),
      netbios: ad.AD_NETBIOS,
      allowedGroupDN: ad.AD_ALLOWED_GROUP_DN,
      recheckSeconds: ad.AD_RECHECK_SECONDS,
    })
  : undefined;
const authenticationService = new LocalAuthenticationService(
  db,
  config.SESSION_TTL_HOURS,
  (accountId) => accessService.resolvePermissions(accountId),
  (input) => recordAudit(db, input),
  directory,
);

const assetService = new AssetService(db);

const app = await buildApp({
  accessService,
  authenticationService,
  config,
  directory,
  db,
  logger: true,
  objectStorage,
  peopleService,
  readinessCheck: async () => {
    await db.execute(sql`select 1`);
    await objectStorage.ensureReady();
  },
  vacationService,
  ticketService,
  visitService,
  visitConfirmationService,
});

await app.register(assetRoutes, {
  accessService,
  authenticationService,
  assetService,
});

const shutdown = async () => {
  await app.close();
  await client.end();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({
  host: "0.0.0.0",
  port: config.API_PORT,
});
