import {
  date,
  index,
  integer,
  jsonb,
  primaryKey,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { employmentRelationships, people } from "./schema.js";
import { userAccounts } from "../auth/schema.js";
import { importRuns } from "./import-schema.js";

export type FieldValue = string | boolean | null;
export const fieldProvenance = pgTable(
  "field_provenance",
  {
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id),
    field: text("field").notNull(),
    value: jsonb("value").$type<FieldValue>(),
    externalValue: jsonb("external_value").$type<FieldValue>(),
    source: text("source").notNull(),
    importRunId: uuid("import_run_id").references(() => importRuns.id),
    checksum: text("checksum"),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.personId, table.field] })],
);

export const employmentMovements = pgTable(
  "employment_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employmentId: uuid("employment_id")
      .notNull()
      .references(() => employmentRelationships.id),
    version: integer("version").notNull(),
    type: text("type").notNull(),
    previous: text("previous"),
    next: text("next"),
    effectiveOn: date("effective_on").notNull(),
    reason: text("reason").notNull(),
    actorAccountId: uuid("actor_account_id").references(() => userAccounts.id),
    source: text("source").notNull(),
    importRunId: uuid("import_run_id").references(() => importRuns.id),
    checksum: text("checksum"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("employment_movements_employment_idx").on(
      table.employmentId,
      table.effectiveOn,
    ),
    uniqueIndex("employment_movements_version_field_unique").on(
      table.employmentId,
      table.version,
      table.type,
    ),
  ],
);
