import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { people, organizationUnits } from "../people/schema.js";
import { userAccounts } from "../auth/schema.js";

export const documentTypes = pgTable(
  "document_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    purpose: text("purpose").notNull(),
    policyReference: text("policy_reference").notNull(),
    retentionDays: integer("retention_days").notNull(),
    sensitive: boolean("sensitive").notNull(),
  },
  (table) => [
    check(
      "document_type_retention",
      sql`${table.retentionDays} between 1 and 36500`,
    ),
  ],
);

export const functionalDocuments = pgTable(
  "functional_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => organizationUnits.id),
    typeId: uuid("type_id")
      .notNull()
      .references(() => documentTypes.id),
    typeName: text("type_name").notNull(),
    title: text("title").notNull(),
    issuedOn: date("issued_on").notNull(),
    validUntil: date("valid_until"),
    source: text("source").notNull(),
    purpose: text("purpose").notNull(),
    policyReference: text("policy_reference").notNull(),
    retentionDays: integer("retention_days").notNull(),
    retainedUntil: timestamp("retained_until", {
      withTimezone: true,
    }).notNull(),
    sensitive: boolean("sensitive").notNull(),
    objectKey: text("object_key").notNull().unique(),
    mime: text("mime").notNull().default("application/pdf"),
    size: integer("size").notNull(),
    authorAccountId: uuid("author_account_id")
      .notNull()
      .references(() => userAccounts.id),
    authorName: text("author_name").notNull(),
    requiresAcknowledgment: boolean("requires_acknowledgment")
      .notNull()
      .default(false),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    acknowledgedByAccountId: uuid("acknowledged_by_account_id").references(
      () => userAccounts.id,
    ),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("functional_documents_owner").on(table.personId, table.createdAt),
    check(
      "functional_documents_size",
      sql`${table.size} between 1 and 5242880`,
    ),
  ],
);
