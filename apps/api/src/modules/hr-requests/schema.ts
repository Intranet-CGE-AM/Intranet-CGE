import { sql } from "drizzle-orm";
import type { CorrectionSnapshot } from "@cge/contracts";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { userAccounts } from "../auth/schema.js";
import {
  employmentRelationships,
  organizationUnits,
} from "../people/schema.js";

export const hrRequestSettings = pgTable(
  "hr_request_settings",
  {
    type: text("type").primaryKey(),
    days: integer("days").notNull(),
  },
  (table) => [
    check("hr_request_settings_days", sql`${table.days} between 1 and 365`),
    check(
      "hr_request_settings_type",
      sql`${table.type} in ('correction','declaration','vacation_question','other')`,
    ),
  ],
);

export const hrRequests = pgTable(
  "hr_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    description: text("description").notNull(),
    correction: jsonb("correction").$type<CorrectionSnapshot>(),
    status: text("status").notNull().default("submitted"),
    version: integer("version").notNull().default(1),
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
    assigneeAccountId: uuid("assignee_account_id").references(
      () => userAccounts.id,
    ),
    response: text("response"),
    informationMessage: text("information_message"),
    informationDeadline: date("information_deadline"),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("hr_requests_owner_idx").on(
      table.requesterAccountId,
      table.createdAt,
    ),
    index("hr_requests_queue_idx").on(table.unitId, table.status, table.dueAt),
    check(
      "hr_requests_status_check",
      sql`${table.status} in ('submitted','in_analysis','completed','rejected','cancelled')`,
    ),
    check(
      "hr_requests_type_check",
      sql`${table.type} in ('correction','declaration','vacation_question','other')`,
    ),
    check(
      "hr_requests_description_check",
      sql`length(${table.description}) between 10 and 2000`,
    ),
    check("hr_requests_version_check", sql`${table.version} > 0`),
  ],
);

export const hrRequestEvents = pgTable(
  "hr_request_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => hrRequests.id),
    version: integer("version").notNull(),
    actorAccountId: uuid("actor_account_id")
      .notNull()
      .references(() => userAccounts.id),
    actorName: text("actor_name").notNull(),
    type: text("type").notNull(),
    message: text("message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("hr_request_events_version_unique").on(
      table.requestId,
      table.version,
    ),
  ],
);
