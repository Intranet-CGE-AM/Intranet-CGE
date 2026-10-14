import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { userAccounts } from "../auth/schema.js";
import { documentTypes, functionalDocuments } from "../documents/schema.js";
import {
  employmentRelationships,
  organizationUnits,
} from "../people/schema.js";

export const occurrenceTypes = pgTable("occurrence_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  active: boolean("active").notNull(),
  requiresSupervisor: boolean("requires_supervisor").notNull(),
  requiresRH: boolean("requires_rh").notNull(),
  requiresDocument: boolean("requires_document").notNull(),
  affectsAvailability: boolean("affects_availability").notNull(),
  documentTypeId: uuid("document_type_id").references(() => documentTypes.id),
});

export const occurrences = pgTable(
  "occurrences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    typeId: uuid("type_id")
      .notNull()
      .references(() => occurrenceTypes.id),
    typeName: text("type_name").notNull(),
    requiresSupervisor: boolean("requires_supervisor").notNull(),
    requiresRH: boolean("requires_rh").notNull(),
    requiresDocument: boolean("requires_document").notNull(),
    affectsAvailability: boolean("affects_availability").notNull(),
    documentTypeId: uuid("document_type_id").references(() => documentTypes.id),
    documentId: uuid("document_id").references(() => functionalDocuments.id),
    requesterAccountId: uuid("requester_account_id")
      .notNull()
      .references(() => userAccounts.id),
    requesterName: text("requester_name").notNull(),
    employmentId: uuid("employment_id")
      .notNull()
      .references(() => employmentRelationships.id),
    supervisorRelationshipId: uuid("supervisor_relationship_id").references(
      () => employmentRelationships.id,
    ),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => organizationUnits.id),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    justification: text("justification").notNull(),
    status: text("status").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("occurrences_queue_idx").on(table.unitId, table.status),
    index("occurrences_owner_idx").on(
      table.requesterAccountId,
      table.createdAt,
    ),
    check("occurrences_dates", sql`${table.endDate} >= ${table.startDate}`),
    check(
      "occurrences_status",
      sql`${table.status} in ('draft','submitted','supervisor_approved','final_approved','rejected','cancelled')`,
    ),
    check("occurrences_version", sql`${table.version} > 0`),
  ],
);

export const occurrenceEvents = pgTable(
  "occurrence_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    occurrenceId: uuid("occurrence_id")
      .notNull()
      .references(() => occurrences.id),
    version: integer("version").notNull(),
    actorAccountId: uuid("actor_account_id")
      .notNull()
      .references(() => userAccounts.id),
    type: text("type").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("occurrence_events_version").on(
      table.occurrenceId,
      table.version,
    ),
  ],
);
