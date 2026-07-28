import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  primaryKey,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { userAccounts } from "../auth/schema";
import { organizationUnits } from "../people/schema";

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    description: varchar("description", { length: 240 }),
  },
  (table) => [uniqueIndex("roles_name_unique").on(table.name)],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permission: varchar("permission", { length: 100 }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permission] })],
);

export const roleAssignments = pgTable(
  "role_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => userAccounts.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id").references(() => organizationUnits.id),
  },
  (table) => [
    index("role_assignments_account_idx").on(table.accountId),
    index("role_assignments_unit_idx").on(table.unitId),
    uniqueIndex("role_assignments_global_unique")
      .on(table.accountId, table.roleId)
      .where(sql`${table.unitId} is null`),
    uniqueIndex("role_assignments_unit_unique")
      .on(table.accountId, table.roleId, table.unitId)
      .where(sql`${table.unitId} is not null`),
  ],
);
