import "dotenv/config";

import { sql } from "drizzle-orm";

import { buildApp } from "./app";
import { loadConfig } from "./config";
import { createDatabase } from "./db/client";

const config = loadConfig();
const { client, db } = createDatabase(config.DATABASE_URL);
const app = await buildApp({
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
