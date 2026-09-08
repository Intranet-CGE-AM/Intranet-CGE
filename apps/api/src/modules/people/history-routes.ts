import {
  employmentHistorySchema,
  permissionAllows,
  permissionUnitIds,
  personInputSchema,
} from "@cge/contracts";
import { and, desc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import { requireAuthenticatedUser } from "../access/authorize.js";
import type { AuthenticationService } from "../auth/service.js";
import { userAccounts } from "../auth/schema.js";
import {
  employmentCategories,
  employmentRelationships,
  organizationUnits,
  people,
} from "./schema.js";
import { employmentMovements, fieldProvenance } from "./history-schema.js";
import { changeEmployment, historyError } from "./history.js";
import { recordAudit } from "../audit/service.js";
import { hrRequests } from "../hr-requests/schema.js";
import { checklists } from "../onboarding/schema.js";

const movementInput = z
  .strictObject({
    expectedVersion: z.number().int().positive(),
    effectiveOn: z.iso.date(),
    reason: z.string().trim().min(10).max(2000),
    confirmTermination: z.boolean().optional(),
    changes: personInputSchema.shape.employment
      .partial()
      .extend({ endDate: z.iso.date().optional() })
      .strict(),
  })
  .refine(
    (value) => !value.changes.endDate || value.confirmTermination === true,
    {
      message:
        "Confirme que o desligamento desativa a conta e encerra as sessões.",
    },
  );

export const employmentHistoryRoutes: FastifyPluginAsync<{
  db: Database;
  authenticationService: AuthenticationService;
}> = async (app, { db, authenticationService }) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  api.get(
    "/api/employment-people",
    {
      schema: {
        querystring: z.object({
          query: z.string().trim().max(120).default(""),
        }),
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      if (!permissionAllows(user.permissions, "employment.manage_history"))
        return historyError(
          403,
          "Você não possui acesso ao histórico funcional.",
        );
      const units = permissionUnitIds(
        user.permissions,
        "employment.manage_history",
      );
      const rows = await db
        .select({ id: people.id, name: people.fullName })
        .from(people)
        .innerJoin(
          employmentRelationships,
          eq(employmentRelationships.personId, people.id),
        )
        .where(
          and(
            eq(
              employmentRelationships.id,
              sql`(select latest.id from employment_relationships latest where latest.person_id = ${people.id} order by (latest.end_date is null) desc, latest.start_date desc limit 1)`,
            ),
            units === null
              ? undefined
              : units.length
                ? inArray(employmentRelationships.unitId, units)
                : sql`false`,
            request.query.query
              ? ilike(people.fullName, `%${request.query.query}%`)
              : undefined,
          ),
        )
        .orderBy(people.fullName)
        .limit(30);
      return { people: rows };
    },
  );
  api.get(
    "/api/employment-options",
    {
      schema: {
        querystring: z.object({
          query: z.string().trim().max(120).default(""),
          purpose: z.enum(["movement", "correction"]).default("movement"),
          unitId: z.uuid().optional(),
        }),
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const correction = request.query.purpose === "correction";
      if (
        correction
          ? !user.employment ||
            !permissionAllows(
              user.permissions,
              "hr_requests.create",
              user.employment.unit.id,
            )
          : !permissionAllows(user.permissions, "employment.manage_history")
      )
        return historyError(403, "Você não possui acesso às movimentações.");
      const units = correction
        ? null
        : permissionUnitIds(user.permissions, "employment.manage_history");
      const [unitOptions, categories, supervisors] = await Promise.all([
        db
          .select({ id: organizationUnits.id, name: organizationUnits.name })
          .from(organizationUnits)
          .where(
            and(
              eq(organizationUnits.active, true),
              units === null
                ? undefined
                : units.length
                  ? inArray(organizationUnits.id, units)
                  : sql`false`,
            ),
          )
          .orderBy(organizationUnits.name),
        db
          .select({
            id: employmentCategories.id,
            name: employmentCategories.name,
          })
          .from(employmentCategories)
          .where(eq(employmentCategories.active, true))
          .orderBy(employmentCategories.name),
        db
          .select({ id: employmentRelationships.id, name: people.fullName })
          .from(employmentRelationships)
          .innerJoin(people, eq(people.id, employmentRelationships.personId))
          .where(
            and(
              isNull(employmentRelationships.endDate),
              correction
                ? eq(
                    employmentRelationships.unitId,
                    request.query.unitId ?? user.employment!.unit.id,
                  )
                : undefined,
              units === null
                ? undefined
                : units.length
                  ? inArray(employmentRelationships.unitId, units)
                  : sql`false`,
              request.query.query
                ? ilike(people.fullName, `%${request.query.query}%`)
                : undefined,
            ),
          )
          .orderBy(people.fullName)
          .limit(30),
      ]);
      return { units: unitOptions, categories, supervisors };
    },
  );
  async function history(personId: string, includePersonal = false) {
    const [person] = await db
      .select()
      .from(people)
      .where(eq(people.id, personId));
    const employments = await db
      .select()
      .from(employmentRelationships)
      .where(eq(employmentRelationships.personId, personId))
      .orderBy(desc(employmentRelationships.startDate));
    const movements = await db
      .select({
        id: employmentMovements.id,
        employmentId: employmentMovements.employmentId,
        version: employmentMovements.version,
        type: employmentMovements.type,
        previous: employmentMovements.previous,
        next: employmentMovements.next,
        effectiveOn: employmentMovements.effectiveOn,
        reason: employmentMovements.reason,
        source: employmentMovements.source,
        importRunId: employmentMovements.importRunId,
        checksum: employmentMovements.checksum,
        createdAt: employmentMovements.createdAt,
        actorName: people.fullName,
      })
      .from(employmentMovements)
      .innerJoin(
        employmentRelationships,
        eq(employmentRelationships.id, employmentMovements.employmentId),
      )
      .leftJoin(
        userAccounts,
        eq(userAccounts.id, employmentMovements.actorAccountId),
      )
      .leftJoin(people, eq(people.id, userAccounts.personId))
      .where(eq(employmentRelationships.personId, personId))
      .orderBy(
        desc(employmentMovements.effectiveOn),
        desc(employmentMovements.createdAt),
      );
    const known = await db
      .select()
      .from(fieldProvenance)
      .where(eq(fieldProvenance.personId, personId));
    const current = employments.find((item) => !item.endDate) ?? employments[0];
    const fields = person
      ? {
          fullName: person.fullName,
          preferredName: person.preferredName,
          ...(includePersonal
            ? {
                birthDate: person.birthDate,
                birthdayVisible: person.birthdayVisible,
              }
            : {}),
          ...(current
            ? Object.fromEntries(
                [
                  "unitId",
                  "categoryId",
                  "jobTitle",
                  "supervisorRelationshipId",
                  "employeeNumber",
                  "startDate",
                  "endDate",
                ].map((field) => [
                  `employment.${field}`,
                  current[field as keyof typeof current],
                ]),
              )
            : {}),
        }
      : {};
    const provenance = Object.entries(fields).map(([field, value]) => ({
      field,
      value: value as string | boolean | null,
      externalValue: null as string | boolean | null,
      source: "legacy",
      importRunId: null as string | null,
      checksum: null as string | null,
      syncedAt: null as Date | null,
      updatedAt: person!.updatedAt,
      ...known.find((item) => item.field === field),
    }));
    const pending = employments.length
      ? await db
          .select({ correction: hrRequests.correction })
          .from(hrRequests)
          .where(
            and(
              inArray(
                hrRequests.employmentId,
                employments.map((item) => item.id),
              ),
              inArray(hrRequests.status, ["submitted", "in_analysis"]),
              eq(hrRequests.type, "correction"),
            ),
          )
      : [];
    const pendingFields = new Set(
      pending.flatMap((item) =>
        item.correction
          ? [
              ...Object.keys(item.correction.proposed).filter(
                (field) => field !== "employment",
              ),
              ...Object.keys(item.correction.proposed.employment ?? {}).map(
                (field) => `employment.${field}`,
              ),
            ]
          : [],
      ),
    );
    const referenceIds = [
      ...movements.flatMap((item) =>
        ["unitId", "categoryId", "supervisorRelationshipId"].includes(item.type)
          ? [item.previous, item.next].filter((value): value is string =>
              Boolean(value),
            )
          : [],
      ),
      ...provenance.flatMap((item) =>
        [
          "employment.unitId",
          "employment.categoryId",
          "employment.supervisorRelationshipId",
        ].includes(item.field)
          ? [item.value, item.externalValue].filter(
              (value): value is string => typeof value === "string",
            )
          : [],
      ),
    ];
    const references = referenceIds.length
      ? (
          await Promise.all([
            db
              .select({
                id: organizationUnits.id,
                name: organizationUnits.name,
              })
              .from(organizationUnits)
              .where(inArray(organizationUnits.id, referenceIds)),
            db
              .select({
                id: employmentCategories.id,
                name: employmentCategories.name,
              })
              .from(employmentCategories)
              .where(inArray(employmentCategories.id, referenceIds)),
            db
              .select({ id: employmentRelationships.id, name: people.fullName })
              .from(employmentRelationships)
              .innerJoin(
                people,
                eq(people.id, employmentRelationships.personId),
              )
              .where(inArray(employmentRelationships.id, referenceIds)),
          ])
        ).flat()
      : [];
    const labels = new Map(references.map((item) => [item.id, item.name]));
    const [pendingChecklists] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(checklists)
      .where(
        and(
          eq(checklists.personId, personId),
          sql`${checklists.items} @> '[{"status":"pending"}]'::jsonb`,
        ),
      );
    return employmentHistorySchema.parse({
      personName: person?.fullName ?? null,
      pendingChecklistCount: pendingChecklists?.count ?? 0,
      version: employments.find((item) => !item.endDate)?.version ?? null,
      employments: employments.map(
        ({
          id,
          version,
          startDate,
          endDate,
          jobTitle,
          unitId,
          categoryId,
          supervisorRelationshipId,
          employeeNumber,
        }) => ({
          id,
          version,
          startDate,
          endDate,
          jobTitle,
          unitId,
          categoryId,
          supervisorRelationshipId,
          employeeNumber,
        }),
      ),
      movements: movements.map((item) => ({
        ...item,
        previousLabel: labels.get(item.previous ?? "") ?? item.previous,
        nextLabel: labels.get(item.next ?? "") ?? item.next,
      })),
      provenance: provenance.map((item) => ({
        ...item,
        localLabel:
          typeof item.value === "boolean"
            ? item.value
              ? "Sim"
              : "Não"
            : (labels.get(item.value ?? "") ?? item.value ?? "Não informado"),
        externalLabel:
          typeof item.externalValue === "boolean"
            ? item.externalValue
              ? "Sim"
              : "Não"
            : (labels.get(item.externalValue ?? "") ??
              item.externalValue ??
              "Não informado"),
        state: pendingFields.has(item.field)
          ? "pending"
          : !item.syncedAt
            ? "unavailable"
            : item.value === item.externalValue
              ? "synchronized"
              : "divergent",
      })),
    });
  }
  api.get(
    "/api/me/employment-history",
    { schema: { querystring: z.strictObject({}) } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      await recordAudit(db, {
        actorAccountId: user.account.id,
        action: "employment.history-read",
        objectType: "person",
        objectId: user.person.id,
        outcome: "success",
      });
      return reply
        .header("Cache-Control", "no-store")
        .send(await history(user.person.id, true));
    },
  );
  api.get(
    "/api/people/:id/employment-history",
    { schema: { params: z.object({ id: z.uuid() }) } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const [employment] = await db
        .select()
        .from(employmentRelationships)
        .where(eq(employmentRelationships.personId, request.params.id))
        .orderBy(desc(employmentRelationships.startDate))
        .limit(1);
      if (
        !employment ||
        !permissionAllows(
          user.permissions,
          "employment.manage_history",
          employment.unitId,
        )
      )
        return historyError(404, "Vínculo não encontrado no seu escopo.");
      await recordAudit(db, {
        actorAccountId: user.account.id,
        action: "employment.history-read",
        objectType: "person",
        objectId: request.params.id,
        outcome: "success",
      });
      return reply
        .header("Cache-Control", "no-store")
        .send(
          await history(
            request.params.id,
            user.person.id === request.params.id ||
              permissionAllows(
                user.permissions,
                "people.manage",
                employment.unitId,
              ),
          ),
        );
    },
  );
  api.post(
    "/api/people/:id/movements",
    { schema: { params: z.object({ id: z.uuid() }), body: movementInput } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "America/Manaus",
      });
      if (
        request.body.effectiveOn > today ||
        (request.body.changes.endDate &&
          request.body.changes.endDate !== request.body.effectiveOn)
      )
        return historyError(
          400,
          "Registre uma vigência já iniciada; no desligamento, use a mesma data de encerramento.",
        );
      const employment = await db.transaction((tx) =>
        changeEmployment(tx, request.params.id, request.body.changes, {
          ...request.body,
          actorAccountId: user.account.id,
          permissions: user.permissions,
          permission: "employment.manage_history",
        }),
      );
      if (employment.version === request.body.expectedVersion)
        return historyError(
          400,
          "Informe um valor diferente do cadastro atual para registrar uma movimentação.",
        );
      return reply.status(201).send({ version: employment.version });
    },
  );
};
