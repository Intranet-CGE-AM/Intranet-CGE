import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
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
    avatarObjectKey: varchar("avatar_object_key", { length: 255 }),
    avatarUpdatedAt: timestamp("avatar_updated_at", { withTimezone: true }),
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

export const organizationPositions = pgTable(
  "organization_positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => organizationUnits.id),
    code: varchar("code", { length: 30 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    plannedCount: integer("planned_count").notNull(),
    active: boolean("active").notNull().default(true),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("organization_positions_unit_code_unique").on(
      table.unitId,
      table.code,
    ),
    uniqueIndex("organization_positions_id_unit_unique").on(
      table.id,
      table.unitId,
    ),
    check(
      "organization_positions_planned_nonnegative",
      sql`${table.plannedCount} >= 0`,
    ),
    check("organization_positions_version_positive", sql`${table.version} > 0`),
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
    positionId: uuid("position_id"),
    version: integer("version").notNull().default(1),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "employment_position_same_unit_fk",
      columns: [table.positionId, table.unitId],
      foreignColumns: [organizationPositions.id, organizationPositions.unitId],
    }),
    index("employment_relationships_position_idx").on(table.positionId),
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
