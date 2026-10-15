import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { people } from "../people/schema.js";

export const accountStatusEnum = pgEnum("account_status", [
  "active",
  "disabled",
]);

export const userAccounts = pgTable(
  "user_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id),
    email: varchar("email", { length: 254 }),
    passwordHash: varchar("password_hash", { length: 255 }),
    authProvider: varchar("auth_provider", { length: 10 })
      .notNull()
      .default("local"),
    directoryId: varchar("directory_id", { length: 253 }),
    directoryGuid: uuid("directory_guid"),
    directoryUpn: varchar("directory_upn", { length: 254 }),
    directorySam: varchar("directory_sam", { length: 256 }),
    directoryCheckedAt: timestamp("directory_checked_at", {
      withTimezone: true,
    }),
    status: accountStatusEnum("status").notNull().default("active"),
    forcePasswordChangeAt: timestamp("force_password_change_at", {
      withTimezone: true,
    }),
    passwordChangedAt: timestamp("password_changed_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "user_accounts_auth_provider_check",
      sql`(${table.authProvider} = 'local' AND ${table.email} IS NOT NULL AND ${table.passwordHash} IS NOT NULL AND ${table.directoryGuid} IS NULL AND ${table.directoryId} IS NULL AND ${table.directoryUpn} IS NULL AND ${table.directorySam} IS NULL) OR (${table.authProvider} = 'ad' AND ${table.passwordHash} IS NULL AND ${table.directoryId} IS NOT NULL AND ${table.directoryGuid} IS NOT NULL AND ${table.directoryUpn} IS NOT NULL AND ${table.directorySam} IS NOT NULL AND ${table.forcePasswordChangeAt} IS NULL)`,
    ),
    uniqueIndex("user_accounts_directory_identity_unique").on(
      table.directoryId,
      table.directoryGuid,
    ),
    uniqueIndex("user_accounts_directory_upn_unique").on(
      table.directoryId,
      sql`lower(${table.directoryUpn})`,
    ),
    uniqueIndex("user_accounts_directory_sam_unique").on(
      table.directoryId,
      sql`lower(${table.directorySam})`,
    ),
    uniqueIndex("user_accounts_person_unique").on(table.personId),
    uniqueIndex("user_accounts_email_unique").on(sql`lower(${table.email})`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => userAccounts.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_account_idx").on(table.accountId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);
