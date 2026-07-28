import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { userAccounts } from "../auth/schema";

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorAccountId: uuid("actor_account_id").references(() => userAccounts.id),
    action: varchar("action", { length: 120 }).notNull(),
    objectType: varchar("object_type", { length: 80 }).notNull(),
    objectId: uuid("object_id"),
    outcome: varchar("outcome", { length: 40 }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_events_created_at_idx").on(table.createdAt),
    index("audit_events_actor_idx").on(table.actorAccountId),
    index("audit_events_object_idx").on(table.objectType, table.objectId),
  ],
);
