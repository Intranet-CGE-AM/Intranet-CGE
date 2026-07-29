import type {
  EmploymentCategoryInput,
  OrganizationUnitInput,
  PersonInput,
  PersonUpdate,
} from "@cge/contracts";
import { and, count, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import {
  employmentCategories,
  employmentRelationships,
  organizationUnits,
  people,
} from "./schema.js";
import { avatarUrl } from "./avatar.js";

export class PeopleService {
  constructor(private readonly db: Database) {}

  async listPeople(
    unitIds: string[] | null,
    includeSensitive: boolean,
    options: { limit?: number; offset?: number; query?: string } = {},
  ) {
    const scope =
      unitIds === null
        ? undefined
        : unitIds.length
          ? inArray(employmentRelationships.unitId, unitIds)
          : sql`false`;
    const term = options.query?.trim();
    const search = term
      ? or(
          ilike(people.fullName, `%${term}%`),
          ilike(people.preferredName, `%${term}%`),
          ilike(organizationUnits.name, `%${term}%`),
          ilike(organizationUnits.code, `%${term}%`),
          ilike(employmentCategories.name, `%${term}%`),
          ilike(employmentRelationships.employeeNumber, `%${term}%`),
        )
      : undefined;
    const where = and(scope, search);
    const rowsQuery = this.db
      .select({
        id: people.id,
        fullName: people.fullName,
        preferredName: people.preferredName,
        birthDate: people.birthDate,
        birthdayVisible: people.birthdayVisible,
        avatarObjectKey: people.avatarObjectKey,
        avatarUpdatedAt: people.avatarUpdatedAt,
        employmentId: employmentRelationships.id,
        employeeNumber: employmentRelationships.employeeNumber,
        categoryId: employmentCategories.id,
        categoryName: employmentCategories.name,
        unitId: organizationUnits.id,
        unitCode: organizationUnits.code,
        unitName: organizationUnits.name,
        supervisorRelationshipId:
          employmentRelationships.supervisorRelationshipId,
        startDate: employmentRelationships.startDate,
        endDate: employmentRelationships.endDate,
        jobTitle: employmentRelationships.jobTitle,
      })
      .from(people)
      .innerJoin(
        employmentRelationships,
        and(
          eq(employmentRelationships.personId, people.id),
          isNull(employmentRelationships.endDate),
        ),
      )
      .leftJoin(
        employmentCategories,
        eq(employmentRelationships.categoryId, employmentCategories.id),
      )
      .leftJoin(
        organizationUnits,
        eq(employmentRelationships.unitId, organizationUnits.id),
      )
      .where(where)
      .orderBy(people.fullName);
    const [rows, totals] = await Promise.all([
      options.limit === undefined
        ? rowsQuery
        : rowsQuery.limit(options.limit).offset(options.offset ?? 0),
      this.db
        .select({ total: count() })
        .from(people)
        .innerJoin(
          employmentRelationships,
          and(
            eq(employmentRelationships.personId, people.id),
            isNull(employmentRelationships.endDate),
          ),
        )
        .leftJoin(
          employmentCategories,
          eq(employmentRelationships.categoryId, employmentCategories.id),
        )
        .leftJoin(
          organizationUnits,
          eq(employmentRelationships.unitId, organizationUnits.id),
        )
        .where(where),
    ]);

    return {
      people: rows.map((row) => ({
        id: row.id,
        fullName: row.fullName,
        preferredName: row.preferredName,
        avatarUrl: row.avatarObjectKey
          ? avatarUrl(row.id, row.avatarUpdatedAt)
          : null,
        ...(includeSensitive ? { birthDate: row.birthDate } : {}),
        ...(includeSensitive ? { birthdayVisible: row.birthdayVisible } : {}),
        employment:
          row.employmentId &&
          row.categoryId &&
          row.categoryName &&
          row.unitId &&
          row.unitCode &&
          row.unitName &&
          row.startDate
            ? {
                id: row.employmentId,
                employeeNumber: row.employeeNumber,
                categoryId: row.categoryId,
                categoryName: row.categoryName,
                unitId: row.unitId,
                unitCode: row.unitCode,
                unitName: row.unitName,
                supervisorRelationshipId: row.supervisorRelationshipId,
                startDate: row.startDate,
                endDate: row.endDate,
                jobTitle: row.jobTitle,
              }
            : null,
      })),
      total: totals[0]?.total ?? 0,
    };
  }

  async createPerson(input: PersonInput) {
    return this.db.transaction(async (transaction) => {
      const [person] = await transaction
        .insert(people)
        .values({
          fullName: input.fullName,
          preferredName: input.preferredName ?? null,
          birthDate: input.birthDate ?? null,
          birthdayVisible: input.birthdayVisible,
        })
        .returning({ id: people.id });
      if (!person) {
        throw new Error("Person was not created");
      }
      const [employment] = await transaction
        .insert(employmentRelationships)
        .values({
          ...input.employment,
          personId: person.id,
          jobTitle: input.employment.jobTitle ?? null,
          supervisorRelationshipId:
            input.employment.supervisorRelationshipId ?? null,
        })
        .returning({ id: employmentRelationships.id });
      if (!employment) {
        throw new Error("Employment was not created");
      }
      return { personId: person.id, employmentId: employment.id };
    });
  }

  async getActiveUnitId(personId: string) {
    const [record] = await this.db
      .select({ unitId: employmentRelationships.unitId })
      .from(employmentRelationships)
      .where(
        and(
          eq(employmentRelationships.personId, personId),
          isNull(employmentRelationships.endDate),
        ),
      )
      .limit(1);
    return record?.unitId ?? null;
  }

  async getAvatar(personId: string) {
    const [record] = await this.db
      .select({
        objectKey: people.avatarObjectKey,
        updatedAt: people.avatarUpdatedAt,
      })
      .from(people)
      .where(eq(people.id, personId))
      .limit(1);
    return record ?? null;
  }

  async setAvatar(personId: string, objectKey: string) {
    const updatedAt = new Date();
    const [person] = await this.db
      .update(people)
      .set({
        avatarObjectKey: objectKey,
        avatarUpdatedAt: updatedAt,
        updatedAt,
      })
      .where(eq(people.id, personId))
      .returning({ id: people.id });
    return person ? avatarUrl(person.id, updatedAt) : null;
  }

  async clearAvatar(personId: string) {
    const [person] = await this.db
      .update(people)
      .set({
        avatarObjectKey: null,
        avatarUpdatedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(people.id, personId))
      .returning({ id: people.id });
    return person ?? null;
  }

  async updatePerson(personId: string, input: PersonUpdate) {
    return this.db.transaction(async (transaction) => {
      const personChanges = {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.preferredName !== undefined
          ? { preferredName: input.preferredName }
          : {}),
        ...(input.birthDate !== undefined
          ? { birthDate: input.birthDate }
          : {}),
        ...(input.birthdayVisible !== undefined
          ? { birthdayVisible: input.birthdayVisible }
          : {}),
        updatedAt: new Date(),
      };
      const [person] = await transaction
        .update(people)
        .set(personChanges)
        .where(eq(people.id, personId))
        .returning({ id: people.id });
      if (!person) {
        return null;
      }
      if (input.employment) {
        await transaction
          .update(employmentRelationships)
          .set({
            ...input.employment,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(employmentRelationships.personId, personId),
              isNull(employmentRelationships.endDate),
            ),
          );
      }
      return person;
    });
  }

  async deactivatePerson(personId: string, endDate: string) {
    const [person] = await this.db
      .select({ id: people.id })
      .from(people)
      .where(eq(people.id, personId))
      .limit(1);
    if (!person) {
      return null;
    }
    await this.db
      .update(employmentRelationships)
      .set({ endDate, updatedAt: new Date() })
      .where(
        and(
          eq(employmentRelationships.personId, personId),
          isNull(employmentRelationships.endDate),
        ),
      );
    return person;
  }

  listCategories() {
    return this.db
      .select()
      .from(employmentCategories)
      .orderBy(employmentCategories.name);
  }

  async createCategory(input: EmploymentCategoryInput) {
    const [category] = await this.db
      .insert(employmentCategories)
      .values(input)
      .returning();
    if (!category) {
      throw new Error("Employment category was not created");
    }
    return category;
  }

  listUnits() {
    return this.db
      .select()
      .from(organizationUnits)
      .orderBy(organizationUnits.name);
  }

  async createUnit(input: OrganizationUnitInput) {
    const [unit] = await this.db
      .insert(organizationUnits)
      .values({
        ...input,
        parentId: input.parentId ?? null,
      })
      .returning();
    if (!unit) {
      throw new Error("Organization unit was not created");
    }
    return unit;
  }
}
