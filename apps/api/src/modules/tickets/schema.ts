import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { userAccounts } from "../auth/schema.js";
import { organizationUnits, people } from "../people/schema.js";

export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "viewed",
  "en_route",
  "in_service",
  "completed",
  "cancelled",
  "paused",
  "maintenance",
]);

export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const ticketApprovalStatusEnum = pgEnum("ticket_approval_status", [
  "not_required",
  "pending",
  "approved",
  "rejected",
]);

export const technicalAreaEnum = pgEnum("technical_area", [
  "sistemas",
  "redes",
  "manutencao",
]);

export const ticketCategories = pgTable(
  "ticket_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 60 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    icon: varchar("icon", { length: 80 }),
    color: varchar("color", { length: 60 }),
    sortOrder: integer("sort_order").notNull().default(0),
    allowsFreeText: boolean("allows_free_text").notNull().default(false),
    allowsBeneficiary: boolean("allows_beneficiary").notNull().default(true),
    n1Tips: text("n1_tips"),
    slaHours: integer("sla_hours"),
    defaultPriority: ticketPriorityEnum("default_priority")
      .notNull()
      .default("medium"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ticket_categories_code_unique").on(table.code),
    index("ticket_categories_active_sort_idx").on(
      table.active,
      table.sortOrder,
    ),
  ],
);

export const ticketSubcategories = pgTable(
  "ticket_subcategories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => ticketCategories.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    code: varchar("code", { length: 80 }),
    sortOrder: integer("sort_order").notNull().default(0),
    slaHours: integer("sla_hours"),
    n1Tips: text("n1_tips"),
    defaultPriority: ticketPriorityEnum("default_priority")
      .notNull()
      .default("medium"),
    areaResponsavel: technicalAreaEnum("area_responsavel"),
    requiresApproval: boolean("requires_approval").notNull().default(false),
    dualApproval: boolean("dual_approval").notNull().default(false),
    requiresPresential: boolean("requires_presential").notNull().default(true),
    requiresCauseSolution: boolean("requires_cause_solution")
      .notNull()
      .default(true),
    allowsFreeText: boolean("allows_free_text").notNull().default(false),
    freeTextLabel: varchar("free_text_label", { length: 160 }),
    formType: varchar("form_type", { length: 80 }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ticket_subcategories_category_idx").on(table.categoryId),
    index("ticket_subcategories_active_sort_idx").on(
      table.active,
      table.sortOrder,
    ),
    uniqueIndex("ticket_subcategories_code_unique")
      .on(table.code)
      .where(sql`${table.code} is not null`),
  ],
);

export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketNumber: varchar("ticket_number", { length: 30 }).notNull(),
    trackToken: varchar("track_token", { length: 64 }).notNull(),
    requesterAccountId: uuid("requester_account_id")
      .notNull()
      .references(() => userAccounts.id),
    requesterPersonId: uuid("requester_person_id")
      .notNull()
      .references(() => people.id),
    requesterName: varchar("requester_name", { length: 180 }).notNull(),
    requesterEmail: varchar("requester_email", { length: 254 }),
    requesterEmployeeNumber: varchar("requester_employee_number", {
      length: 50,
    }),
    beneficiaryName: varchar("beneficiary_name", { length: 180 }),
    beneficiaryEmployeeNumber: varchar("beneficiary_employee_number", {
      length: 50,
    }),
    beneficiaryEmail: varchar("beneficiary_email", { length: 254 }),
    beneficiaryDept: varchar("beneficiary_dept", { length: 160 }),
    unitId: uuid("unit_id").references(() => organizationUnits.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => ticketCategories.id),
    subcategoryId: uuid("subcategory_id").references(
      () => ticketSubcategories.id,
    ),
    freeTextDescription: text("free_text_description"),
    anyDeskCode: varchar("anydesk_code", { length: 30 }),
    extraData: jsonb("extra_data").$type<Record<string, unknown>>(),
    priority: ticketPriorityEnum("priority").notNull().default("medium"),
    areaResponsavel: technicalAreaEnum("area_responsavel"),
    status: ticketStatusEnum("status").notNull().default("open"),
    approvalStatus: ticketApprovalStatusEnum("approval_status")
      .notNull()
      .default("not_required"),
    assignedTechAccountId: uuid("assigned_tech_account_id").references(
      () => userAccounts.id,
    ),
    presential: boolean("presential").notNull().default(true),
    requiresCauseSolution: boolean("requires_cause_solution")
      .notNull()
      .default(true),
    cause: text("cause"),
    solution: text("solution"),
    completionNote: text("completion_note"),
    cancelNote: text("cancel_note"),
    pauseNote: text("pause_note"),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    totalPausedMs: integer("total_paused_ms").notNull().default(0),
    slaDeadline: timestamp("sla_deadline", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    enRouteAt: timestamp("en_route_at", { withTimezone: true }),
    inServiceAt: timestamp("in_service_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    reopenedAt: timestamp("reopened_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("tickets_number_unique").on(table.ticketNumber),
    uniqueIndex("tickets_track_token_unique").on(table.trackToken),
    index("tickets_requester_idx").on(table.requesterAccountId),
    index("tickets_status_idx").on(table.status),
    index("tickets_approval_status_idx").on(table.approvalStatus),
    index("tickets_assigned_tech_idx").on(table.assignedTechAccountId),
    index("tickets_unit_idx").on(table.unitId),
    index("tickets_category_idx").on(table.categoryId),
    index("tickets_opened_at_idx").on(table.openedAt),
  ],
);

export const ticketApprovals = pgTable(
  "ticket_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id").references(() => organizationUnits.id),
    approverAccountId: uuid("approver_account_id").references(
      () => userAccounts.id,
    ),
    isAtecApproval: boolean("is_atec_approval").notNull().default(false),
    status: ticketApprovalStatusEnum("status").notNull().default("pending"),
    note: text("note"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ticket_approvals_ticket_idx").on(table.ticketId),
    index("ticket_approvals_unit_status_idx").on(table.unitId, table.status),
  ],
);

export const ticketMessages = pgTable(
  "ticket_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    authorAccountId: uuid("author_account_id").references(
      () => userAccounts.id,
    ),
    fromUser: boolean("from_user").notNull().default(false),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("ticket_messages_ticket_idx").on(table.ticketId)],
);

export const ticketEvents = pgTable(
  "ticket_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    actorAccountId: uuid("actor_account_id").references(() => userAccounts.id),
    fromStatus: ticketStatusEnum("from_status"),
    toStatus: ticketStatusEnum("to_status").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("ticket_events_ticket_idx").on(table.ticketId)],
);

export const ticketFeedbacks = pgTable(
  "ticket_feedbacks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    technicianAccountId: uuid("technician_account_id").references(
      () => userAccounts.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ticket_feedbacks_ticket_unique").on(table.ticketId),
    index("ticket_feedbacks_technician_idx").on(table.technicianAccountId),
  ],
);

export const ticketCounters = pgTable("ticket_counters", {
  date: varchar("date", { length: 10 }).primaryKey(),
  count: integer("count").notNull().default(0),
});
