import "dotenv/config";

import { sql } from "drizzle-orm";

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./db/client.js";
import { LocalAuthenticationService } from "./modules/auth/service.js";

const config = loadConfig();
const { client, db } = createDatabase(config.DATABASE_URL);
const authenticationService = new LocalAuthenticationService(
  db,
  config.SESSION_TTL_HOURS,
);
const app = await buildApp({
  authenticationService,
  config,
  logger: true,
  readinessCheck: async () => {
    await db.execute(sql`select 1`);
  },
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
