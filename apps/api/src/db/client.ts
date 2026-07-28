import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

export function createDatabase(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    max: 10,
    onnotice: () => undefined,
  });
  const db = drizzle(client, { schema });
  return { client, db };
}

export type Database = ReturnType<typeof createDatabase>["db"];
