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
import {
  changeEmployment,
  recordAdmission,
  recordManualFields,
  type MovementContext,
  type Transaction,
} from "./history.js";

export class PeopleService {
  constructor(private readonly db: Database) {}

  async listPeople(
    unitIds: string[] | null,
    includeSensitive: boolean,
    options: {
      personId?: string;
      employmentId?: string;
      limit?: number;
      offset?: number;
      query?: string;
    } = {},
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
    const where = and(
      scope,
      search,
      options.personId ? eq(people.id, options.personId) : undefined,
      options.employmentId
        ? eq(employmentRelationships.id, options.employmentId)
        : undefined,
    );
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

  async createPerson(input: PersonInput, actorAccountId: string) {
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
        .returning();
      if (!employment) {
        throw new Error("Employment was not created");
      }
      await recordAdmission(transaction, employment, actorAccountId);
      return { personId: person.id, employmentId: employment.id };
    });
  }

  async getDossier(personId: string) {
    const result = await this.listPeople(null, true, { personId, limit: 1 });
    const current = result.people[0];
    if (!current) {
      const [person] = await this.db
        .select({
          id: people.id,
          fullName: people.fullName,
          preferredName: people.preferredName,
          birthDate: people.birthDate,
          birthdayVisible: people.birthdayVisible,
          avatarObjectKey: people.avatarObjectKey,
          avatarUpdatedAt: people.avatarUpdatedAt,
        })
        .from(people)
        .where(eq(people.id, personId));
      if (!person) return null;
      return {
        id: person.id,
        fullName: person.fullName,
        preferredName: person.preferredName,
        birthDate: person.birthDate,
        birthdayVisible: person.birthdayVisible,
        avatarUrl: person.avatarObjectKey
          ? avatarUrl(person.id, person.avatarUpdatedAt)
          : null,
        employment: null,
        supervisorName: null,
      };
    }
    const supervisorId = current.employment?.supervisorRelationshipId;
    const [supervisor] = supervisorId
      ? await this.db
          .select({ name: people.fullName })
          .from(employmentRelationships)
          .innerJoin(people, eq(people.id, employmentRelationships.personId))
          .where(eq(employmentRelationships.id, supervisorId))
      : [];
    return { ...current, supervisorName: supervisor?.name ?? null };
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

  async updatePerson(
    personId: string,
    input: PersonUpdate,
    context: MovementContext,
    transaction?: Transaction,
  ) {
    const update = async (transaction: Transaction) => {
      const [before] = await transaction
        .select()
        .from(people)
        .where(eq(people.id, personId))
        .for("update");
      if (!before) return null;
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
      const personalFields = [
        "fullName",
        "preferredName",
        "birthDate",
        "birthdayVisible",
      ] as const;
      await recordManualFields(
        transaction,
        personId,
        Object.fromEntries(
          personalFields
            .filter(
              (field) =>
                input[field] !== undefined && input[field] !== before[field],
            )
            .map((field) => [field, input[field] ?? null]),
        ),
      );
      if (input.employment) {
        await changeEmployment(
          transaction,
          personId,
          input.employment,
          context,
        );
      }
      return person;
    };
    return transaction ? update(transaction) : this.db.transaction(update);
  }

  async deactivatePerson(
    personId: string,
    endDate: string,
    context: MovementContext,
  ) {
    return this.db.transaction(async (tx) => {
      await changeEmployment(tx, personId, { endDate }, context);
      return { id: personId };
    });
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
