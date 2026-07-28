import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fullName: varchar("full_name", { length: 180 }).notNull(),
    preferredName: varchar("preferred_name", { length: 120 }),
    birthDate: date("birth_date"),
    birthdayVisible: boolean("birthday_visible").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("people_full_name_idx").on(table.fullName)],
);

export const employmentCategories = pgTable(
  "employment_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    vacationEligible: boolean("vacation_eligible").notNull().default(false),
    active: boolean("active").notNull().default(true),
  },
  (table) => [uniqueIndex("employment_categories_name_unique").on(table.name)],
);

export const organizationUnits = pgTable(
  "organization_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 30 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    parentId: uuid("parent_id").references(
      (): AnyPgColumn => organizationUnits.id,
    ),
    active: boolean("active").notNull().default(true),
  },
  (table) => [
    uniqueIndex("organization_units_code_unique").on(table.code),
    index("organization_units_parent_idx").on(table.parentId),
  ],
);

export const employmentRelationships = pgTable(
  "employment_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => employmentCategories.id),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => organizationUnits.id),
    supervisorRelationshipId: uuid("supervisor_relationship_id").references(
      (): AnyPgColumn => employmentRelationships.id,
    ),
    employeeNumber: varchar("employee_number", { length: 50 }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    jobTitle: varchar("job_title", { length: 160 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("employment_relationships_person_idx").on(table.personId),
    index("employment_relationships_unit_idx").on(table.unitId),
    index("employment_relationships_supervisor_idx").on(
      table.supervisorRelationshipId,
    ),
    uniqueIndex("employment_relationships_employee_number_unique")
      .on(table.employeeNumber)
      .where(sql`${table.employeeNumber} is not null`),
    uniqueIndex("employment_relationships_one_active_per_person")
      .on(table.personId)
      .where(sql`${table.endDate} is null`),
    check(
      "employment_relationships_valid_dates",
      sql`${table.endDate} is null or ${table.endDate} >= ${table.startDate}`,
    ),
  ],
);
