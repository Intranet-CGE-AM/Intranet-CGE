import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { userAccounts } from "../auth/schema.js";
import { employmentRelationships } from "../people/schema.js";

export const vacationStatusEnum = pgEnum("vacation_status", [
  "draft",
  "submitted",
  "supervisor_approved",
  "supervisor_rejected",
  "final_approved",
  "final_rejected",
  "cancelled",
]);

export const vacationRequests = pgTable(
  "vacation_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employmentRelationshipId: uuid("employment_relationship_id")
      .notNull()
      .references(() => employmentRelationships.id),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: vacationStatusEnum("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("vacation_requests_employment_idx").on(
      table.employmentRelationshipId,
    ),
    index("vacation_requests_status_idx").on(table.status),
    check(
      "vacation_requests_valid_dates",
      sql`${table.endDate} >= ${table.startDate}`,
    ),
    check("vacation_requests_positive_version", sql`${table.version} > 0`),
  ],
);

export const vacationRequestEvents = pgTable(
  "vacation_request_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vacationRequestId: uuid("vacation_request_id")
      .notNull()
      .references(() => vacationRequests.id, { onDelete: "cascade" }),
    actorAccountId: uuid("actor_account_id")
      .notNull()
      .references(() => userAccounts.id),
    type: text("type").notNull(),
    comment: text("comment"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("vacation_request_events_request_idx").on(table.vacationRequestId),
  ],
);
