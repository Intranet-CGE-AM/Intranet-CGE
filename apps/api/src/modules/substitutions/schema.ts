import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { userAccounts } from "../auth/schema.js";
import { organizationUnits } from "../people/schema.js";

export const substitutions = pgTable(
  "workflow_substitutions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    originalAccountId: uuid("original_account_id")
      .notNull()
      .references(() => userAccounts.id),
    substituteAccountId: uuid("substitute_account_id")
      .notNull()
      .references(() => userAccounts.id),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => organizationUnits.id),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    reason: text("reason").notNull(),
    flows: jsonb("flows").$type<string[]>().notNull(),
    version: integer("version").notNull().default(1),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("substitution_dates", sql`${table.endsOn} >= ${table.startsOn}`),
    check(
      "substitution_distinct_accounts",
      sql`${table.originalAccountId} <> ${table.substituteAccountId}`,
    ),
    check("substitution_flows", sql`jsonb_array_length(${table.flows}) > 0`),
    check("substitution_version", sql`${table.version} > 0`),
    index("substitution_recipient_idx").on(
      table.substituteAccountId,
      table.startsOn,
      table.endsOn,
    ),
    index("substitution_original_idx").on(
      table.originalAccountId,
      table.unitId,
    ),
  ],
);
