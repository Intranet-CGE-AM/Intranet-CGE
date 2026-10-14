import { sql } from "drizzle-orm";
import {
  check,
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { userAccounts } from "../auth/schema.js";
import { documentTypes, functionalDocuments } from "../documents/schema.js";

export const trainingSettings = pgTable(
  "training_settings",
  {
    id: boolean("id").primaryKey().default(true),
    certificateTypeId: uuid("certificate_type_id").references(
      () => documentTypes.id,
    ),
  },
  (table) => [check("training_settings_singleton", sql`${table.id} = true`)],
);
import {
  employmentRelationships,
  organizationUnits,
  people,
} from "../people/schema.js";

export const trainingRecords = pgTable(
  "training_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    certificateId: uuid("certificate_id").references(
      () => functionalDocuments.id,
    ),
    title: text("title").notNull(),
    institution: text("institution").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    hours: numeric("hours", {
      precision: 8,
      scale: 2,
      mode: "number",
    }).notNull(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id),
    requesterAccountId: uuid("requester_account_id")
      .notNull()
      .references(() => userAccounts.id),
    requesterName: text("requester_name").notNull(),
    employmentId: uuid("employment_id")
      .notNull()
      .references(() => employmentRelationships.id),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => organizationUnits.id),
    status: text("status").notNull().default("submitted"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("training_owner_idx").on(table.personId, table.createdAt),
    index("training_queue_idx").on(table.unitId, table.status),
    check("training_dates", sql`${table.endDate} >= ${table.startDate}`),
    check("training_hours", sql`${table.hours} > 0`),
    check(
      "training_status",
      sql`${table.status} in ('submitted','validated','rejected','archived')`,
    ),
    check("training_version", sql`${table.version} > 0`),
  ],
);
export const trainingEvents = pgTable(
  "training_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trainingId: uuid("training_id")
      .notNull()
      .references(() => trainingRecords.id),
    actorAccountId: uuid("actor_account_id")
      .notNull()
      .references(() => userAccounts.id),
    actorName: text("actor_name").notNull(),
    type: text("type").notNull(),
    reason: text("reason"),
    version: integer("version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("training_event_version").on(table.trainingId, table.version),
  ],
);
