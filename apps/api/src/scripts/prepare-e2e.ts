import "dotenv/config";

import { eq, sql } from "drizzle-orm";

import { createDatabase } from "../db/client.js";
import { userAccounts } from "../modules/auth/schema.js";

const databaseUrl = process.env.DATABASE_URL ?? "";
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
if (
  process.env.NODE_ENV !== "test" ||
  !databaseUrl.includes("/intranet_cge_e2e") ||
  !email
) {
  throw new Error("Este preparo só pode executar no banco intranet_cge_e2e.");
}

const { client, db } = createDatabase(databaseUrl);
try {
  await db
    .update(userAccounts)
    .set({ forcePasswordChangeAt: null })
    .where(sql`lower(${userAccounts.email}) = ${email}`);
  const [account] = await db
    .select({ id: userAccounts.id })
    .from(userAccounts)
    .where(eq(userAccounts.email, email))
    .limit(1);
  if (!account) {
    throw new Error("Administrador E2E não foi criado.");
  }
} finally {
  await client.end();
}
