import "dotenv/config";

import { permissionKeys } from "@cge/contracts";
import { argon2id, hash } from "argon2";
import { and, eq, isNull, sql } from "drizzle-orm";

import { loadConfig } from "../config.js";
import { createDatabase } from "../db/client.js";
import {
  roleAssignments,
  rolePermissions,
  roles,
} from "../modules/access/schema.js";
import { recordAudit } from "../modules/audit/service.js";
import { userAccounts } from "../modules/auth/schema.js";
import { people } from "../modules/people/schema.js";

const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
if (!email || !password || password.length < 12) {
  throw new Error(
    "Defina BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD (mínimo de 12 caracteres).",
  );
}

const config = loadConfig();
const { client, db } = createDatabase(config.DATABASE_URL);

try {
  await db.transaction(async (transaction) => {
    let [account] = await transaction
      .select({ id: userAccounts.id })
      .from(userAccounts)
      .where(sql`lower(${userAccounts.email}) = ${email}`)
      .limit(1);
    if (!account) {
      const [person] = await transaction
        .insert(people)
        .values({ fullName: "Administrador da Plataforma" })
        .returning({ id: people.id });
      if (!person) {
        throw new Error("Não foi possível criar a pessoa administradora.");
      }
      [account] = await transaction
        .insert(userAccounts)
        .values({
          personId: person.id,
          email,
          passwordHash: await hash(password, {
            memoryCost: 65_536,
            parallelism: 1,
            timeCost: 3,
            type: argon2id,
          }),
          forcePasswordChangeAt: new Date(),
        })
        .returning({ id: userAccounts.id });
    }
    if (!account) {
      throw new Error("Não foi possível criar a conta administradora.");
    }

    let [role] = await transaction
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, "Administrador da plataforma"))
      .limit(1);
    if (!role) {
      [role] = await transaction
        .insert(roles)
        .values({
          name: "Administrador da plataforma",
          description: "Acesso global para implantação e administração.",
        })
        .returning({ id: roles.id });
    }
    if (!role) {
      throw new Error("Não foi possível criar o papel administrador.");
    }
    await transaction
      .delete(rolePermissions)
      .where(eq(rolePermissions.roleId, role.id));
    await transaction.insert(rolePermissions).values(
      permissionKeys.map((permission) => ({
        roleId: role.id,
        permission,
      })),
    );
    const [assignment] = await transaction
      .select({ id: roleAssignments.id })
      .from(roleAssignments)
      .where(
        and(
          eq(roleAssignments.accountId, account.id),
          eq(roleAssignments.roleId, role.id),
          isNull(roleAssignments.unitId),
        ),
      )
      .limit(1);
    if (!assignment) {
      await transaction.insert(roleAssignments).values({
        accountId: account.id,
        roleId: role.id,
      });
    }
  });

  const [account] = await db
    .select({ id: userAccounts.id })
    .from(userAccounts)
    .where(sql`lower(${userAccounts.email}) = ${email}`)
    .limit(1);
  if (account) {
    await recordAudit(db, {
      actorAccountId: account.id,
      action: "platform-admin.bootstrapped",
      objectType: "account",
      objectId: account.id,
      outcome: "success",
    });
  }
  console.log("Administrador da plataforma provisionado.");
} finally {
  await client.end();
}
