import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { OnboardingTemplate, ChecklistItem } from "@cge/contracts";
import {
  people,
  employmentRelationships,
  organizationUnits,
} from "../people/schema.js";

export const onboardingTemplates = pgTable(
  "onboarding_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    active: boolean("active").notNull(),
    items: jsonb("items").$type<OnboardingTemplate["items"]>().notNull(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    check("onboarding_template_kind", sql`${table.kind} in ('entry','exit')`),
    check("onboarding_template_version", sql`${table.version} > 0`),
    check(
      "onboarding_template_items",
      sql`jsonb_array_length(${table.items}) between 1 and 100`,
    ),
  ],
);
export const checklists = pgTable(
  "checklists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id),
    personName: text("person_name").notNull(),
    employmentId: uuid("employment_id")
      .notNull()
      .references(() => employmentRelationships.id),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => organizationUnits.id),
    templateId: uuid("template_id")
      .notNull()
      .references(() => onboardingTemplates.id),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    items: jsonb("items").$type<ChecklistItem[]>().notNull(),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("checklists_person_idx").on(table.personId),
    index("checklists_unit_idx").on(table.unitId, table.createdAt),
    index("checklists_assignees_idx").using("gin", table.items),
    check("checklist_kind", sql`${table.kind} in ('entry','exit')`),
    check("checklist_version", sql`${table.version} > 0`),
    check(
      "checklist_items",
      sql`jsonb_array_length(${table.items}) between 1 and 100`,
    ),
  ],
);
