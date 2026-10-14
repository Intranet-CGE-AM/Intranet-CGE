import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { userAccounts } from "../auth/schema.js";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => userAccounts.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message")
      .notNull()
      .default("Consulte o andamento na intranet."),
    href: text("href").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("notifications_dedupe").on(table.accountId, table.dedupeKey),
    index("notifications_account_created").on(table.accountId, table.createdAt),
  ],
);
