import { sql } from "drizzle-orm";

import {
  check,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  varchar,
  uuid,
} from "drizzle-orm/pg-core";

import { userAccounts } from "../auth/schema.js";
import { organizationUnits } from "../people/schema.js";

export const visitStatusEnum = pgEnum("visit_status", [
  "pending",
  "approved",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
  "rejected",
]);

export const visitTypeEnum = pgEnum("visit_type", [
  "institutional_meeting",
  "technical_support",
  "technical_visit",
  "alignment_meeting",
  "presentation",
  "audit",
  "inspection",
  "training",
  "external_service",
  "other",
]);

export const visits = pgTable(
  "visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    protocol: text("protocol").notNull().unique(),

    type: visitTypeEnum("type").notNull(),

    subject: text("subject").notNull(),

    description: text("description"),

    organization: text("organization").notNull(),

    sector: text("sector"),

    scheduledDate: date("scheduled_date").notNull(),

    startTime: time("start_time", {
      withTimezone: false,
    }).notNull(),

    endTime: time("end_time", {
      withTimezone: false,
    }).notNull(),

    location: text("location").notNull(),

    responsibleUnitId: uuid("responsible_unit_id").references(
      () => organizationUnits.id,
    ),

    responsibleAccountId: uuid("responsible_account_id").references(
      () => userAccounts.id,
    ),

    createdByAccountId: uuid("created_by_account_id")
      .notNull()
      .references(() => userAccounts.id),

    status: visitStatusEnum("status")
      .notNull()
      .default("pending"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },

  (table) => [
    index("visits_scheduled_date_idx").on(table.scheduledDate),

    index("visits_status_idx").on(table.status),

    index("visits_responsible_unit_idx").on(
      table.responsibleUnitId,
    ),

    check(
      "visits_valid_time",
      sql`${table.endTime} > ${table.startTime}`,
    ),
  ],
);

export const visitVisitors = pgTable(
  "visit_visitors",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    visitId: uuid("visit_id")
      .notNull()
      .references(() => visits.id, {
        onDelete: "cascade",
      }),

    name: text("name").notNull(),

    position: text("position"),

    organization: text("organization").notNull(),

    sector: text("sector"),

    email: text("email"),

    phone: text("phone"),

    cpf: text("cpf"),


    confirmationStatus: varchar(
      "confirmation_status",
      {
        length: 20,
      },
    )
      .notNull()
      .default("not_sent"),

    confirmationTokenHash: varchar(
      "confirmation_token_hash",
      {
        length: 64,
      },
    ),

    confirmationSentAt: timestamp(
      "confirmation_sent_at",
      {
        withTimezone: true,
      },
    ),

    confirmationRespondedAt: timestamp(
      "confirmation_responded_at",
      {
        withTimezone: true,
      },
    ),

    confirmationExpiresAt: timestamp(
      "confirmation_expires_at",
      {
        withTimezone: true,
      },
    ),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },

  (table) => [
    index("visit_visitors_visit_idx").on(table.visitId),
  ],
);

export const visitEvents = pgTable(
  "visit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    visitId: uuid("visit_id")
      .notNull()
      .references(() => visits.id, {
        onDelete: "cascade",
      }),

    actorAccountId: uuid("actor_account_id")
      .notNull()
      .references(() => userAccounts.id),

    type: text("type").notNull(),

    comment: text("comment"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },

  (table) => [
    index("visit_events_visit_idx").on(table.visitId),
  ],
);