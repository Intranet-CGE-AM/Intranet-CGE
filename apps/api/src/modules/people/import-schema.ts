import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { userAccounts } from "../auth/schema.js";

export const importStatusEnum = pgEnum("import_status", [
  "previewed",
  "processing",
  "completed",
  "failed",
]);

export const importRuns = pgTable(
  "import_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    originalFilename: varchar("original_filename", { length: 255 }).notNull(),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    status: importStatusEnum("status").notNull().default("previewed"),
    totalRows: integer("total_rows").notNull().default(0),
    successfulRows: integer("successful_rows").notNull().default(0),
    failedRows: integer("failed_rows").notNull().default(0),
    createdByAccountId: uuid("created_by_account_id")
      .notNull()
      .references(() => userAccounts.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("import_runs_created_at_idx").on(table.createdAt),
    index("import_runs_checksum_idx").on(table.checksum),
  ],
);

export const importErrors = pgTable(
  "import_errors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    importRunId: uuid("import_run_id")
      .notNull()
      .references(() => importRuns.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    field: varchar("field", { length: 100 }),
    message: text("message").notNull(),
    rowData: jsonb("row_data").$type<Record<string, string | null>>(),
  },
  (table) => [index("import_errors_run_idx").on(table.importRunId)],
);
