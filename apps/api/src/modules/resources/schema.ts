import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { PublicationAudience } from "@cge/contracts";
import { userAccounts } from "../auth/schema.js";
export const hrResources = pgTable(
  "hr_resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rootId: uuid("root_id").references((): AnyPgColumn => hrResources.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    category: text("category").notNull(),
    responsibleName: text("responsible_name").notNull(),
    validFrom: date("valid_from").notNull(),
    validUntil: date("valid_until").notNull(),
    audience: jsonb("audience").$type<PublicationAudience>().notNull(),
    requiresAcknowledgment: boolean("requires_acknowledgment").notNull(),
    externalUrl: text("external_url"),
    objectKey: text("object_key"),
    fileSize: integer("file_size"),
    version: integer("version").notNull().default(1),
    status: text("status").notNull().default("published"),
    authorAccountId: uuid("author_account_id")
      .notNull()
      .references(() => userAccounts.id),
    authorName: text("author_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("hr_resources_current_idx").on(
      table.status,
      table.validFrom,
      table.validUntil,
    ),
    check(
      "hr_resources_type",
      sql`${table.type} in ('policy','manual','form','external_link')`,
    ),
    check(
      "hr_resources_status",
      sql`${table.status} in ('published','superseded','archived')`,
    ),
    check("hr_resources_version", sql`${table.version} > 0`),
    uniqueIndex("hr_resources_revision_unique").on(table.rootId, table.version),
    check(
      "hr_resources_root_version",
      sql`(${table.rootId} is null and ${table.version} = 1) or (${table.rootId} is not null and ${table.version} > 1)`,
    ),
    check(
      "hr_resources_source",
      sql`(${table.externalUrl} is not null and ${table.objectKey} is null and ${table.fileSize} is null) or (${table.externalUrl} is null and ${table.objectKey} is not null and ${table.fileSize} is not null and ${table.fileSize} > 0 and ${table.fileSize} <= 10485760)`,
    ),
    check(
      "hr_resources_external_link",
      sql`${table.type} <> 'external_link' or ${table.externalUrl} is not null`,
    ),
    check(
      "hr_resources_period",
      sql`${table.validUntil} >= ${table.validFrom}`,
    ),
  ],
);
export const resourceAcknowledgments = pgTable(
  "hr_resource_acknowledgments",
  {
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => hrResources.id),
    accountId: uuid("account_id")
      .notNull()
      .references(() => userAccounts.id),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.resourceId, table.accountId] })],
);
