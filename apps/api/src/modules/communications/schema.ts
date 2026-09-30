import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { PublicationAudience } from "@cge/contracts";
import { userAccounts } from "../auth/schema.js";

export const hrCommunications = pgTable(
  "hr_communications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    body: text("body").notNull(),
    publicationAt: timestamp("publication_at", {
      withTimezone: true,
    }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    audience: jsonb("audience").$type<PublicationAudience>().notNull(),
    requiresAcknowledgment: boolean("requires_acknowledgment").notNull(),
    status: text("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    authorAccountId: uuid("author_account_id")
      .notNull()
      .references(() => userAccounts.id),
    authorName: text("author_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("hr_communications_publication_idx").on(
      table.status,
      table.publicationAt,
      table.expiresAt,
    ),
    check(
      "hr_communication_status",
      sql`${table.status} in ('draft','scheduled','published','archived')`,
    ),
    check("hr_communication_version", sql`${table.version} > 0`),
    check(
      "hr_communication_period",
      sql`${table.expiresAt} > ${table.publicationAt}`,
    ),
  ],
);
export const communicationAcknowledgments = pgTable(
  "hr_communication_acknowledgments",
  {
    communicationId: uuid("communication_id")
      .notNull()
      .references(() => hrCommunications.id),
    accountId: uuid("account_id")
      .notNull()
      .references(() => userAccounts.id),
    version: integer("version").notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.communicationId, table.accountId, table.version],
    }),
  ],
);
