import {
  auditDocumentEventTypeSchema,
  auditDocumentStatusSchema,
  type Delegation,
} from "@cge/contracts";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { userAccounts } from "../auth/schema.js";
import { organizationUnits } from "../people/schema.js";

export const auditDocumentStatusEnum = pgEnum(
  "audit_document_status",
  auditDocumentStatusSchema.enum,
);
export const auditDocumentEventTypeEnum = pgEnum(
  "audit_document_event_type",
  auditDocumentEventTypeSchema.enum,
);

export const auditDocumentSettings = pgTable(
  "audit_document_settings",
  {
    id: smallint("id").primaryKey().default(1),
    bottleneckRounds: integer("bottleneck_rounds").notNull().default(3),
  },
  (table) => [
    check("audit_document_settings_singleton", sql`${table.id} = 1`),
    check(
      "audit_document_settings_rounds",
      sql`${table.bottleneckRounds} between 1 and 20`,
    ),
  ],
);

export const auditDocuments = pgTable(
  "audit_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => organizationUnits.id),
    title: text("title").notNull(),
    reference: text("reference"),
    category: text("category"),
    status: auditDocumentStatusEnum("status").notNull().default("in_review"),
    version: integer("version").notNull().default(1),
    correctionRounds: integer("correction_rounds").notNull().default(0),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdByAccountId: uuid("created_by_account_id")
      .notNull()
      .references(() => userAccounts.id),
    createdByName: text("created_by_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_documents_unit_queue_idx").on(
      table.unitId,
      table.status,
      table.statusChangedAt,
    ),
    index("audit_documents_queue_idx").on(table.status, table.statusChangedAt),
    check(
      "audit_documents_title_check",
      sql`length(${table.title}) between 3 and 200`,
    ),
    check("audit_documents_version_check", sql`${table.version} > 0`),
    check("audit_documents_rounds_check", sql`${table.correctionRounds} >= 0`),
  ],
);

export const auditDocumentFiles = pgTable(
  "audit_document_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => auditDocuments.id),
    number: integer("number").notNull(),
    objectKey: text("object_key").notNull().unique(),
    fileName: text("file_name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    sha256: text("sha256").notNull(),
    note: text("note"),
    uploadedByAccountId: uuid("uploaded_by_account_id")
      .notNull()
      .references(() => userAccounts.id),
    uploadedByName: text("uploaded_by_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("audit_document_files_number_unique").on(
      table.documentId,
      table.number,
    ),
    check("audit_document_files_number_check", sql`${table.number} > 0`),
    check(
      "audit_document_files_size_check",
      sql`${table.size} between 1 and 20971520`,
    ),
  ],
);

export const auditDocumentEvents = pgTable(
  "audit_document_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => auditDocuments.id),
    type: auditDocumentEventTypeEnum("type").notNull(),
    fromStatus: auditDocumentStatusEnum("from_status"),
    toStatus: auditDocumentStatusEnum("to_status"),
    fileId: uuid("file_id").references(() => auditDocumentFiles.id),
    message: text("message"),
    actorAccountId: uuid("actor_account_id")
      .notNull()
      .references(() => userAccounts.id),
    actorName: text("actor_name").notNull(),
    delegation: jsonb("delegation").$type<Delegation>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_document_events_document_idx").on(
      table.documentId,
      table.createdAt,
    ),
    uniqueIndex("audit_document_events_read_unique")
      .on(table.fileId, table.actorAccountId)
      .where(sql`${table.type} = 'read'`),
  ],
);
