import {
  authErrorSchema,
  availabilityQuerySchema,
  teamAvailabilitySchema,
  permissionAllows,
  type PermissionKey,
} from "@cge/contracts";
import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Database } from "../../db/client.js";
import { requireAuthenticatedUser } from "../access/authorize.js";
import type { AuthenticationService } from "../auth/service.js";
import { auditEvents } from "../audit/schema.js";
import { occurrences } from "../occurrences/schema.js";
import { vacationRequests } from "../vacations/schema.js";
import {
  employmentCategories,
  employmentRelationships as employment,
  organizationUnits,
  people,
} from "./schema.js";

export const availabilityRoutes: FastifyPluginAsync<{
  db: Database;
  authenticationService: AuthenticationService;
}> = async (app, { db, authenticationService }) => {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/api/team-availability",
    {
      schema: {
        querystring: availabilityQuerySchema,
        response: { 200: teamAvailabilitySchema, 403: authErrorSchema },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const allowed = (key: PermissionKey, unitId?: string) =>
        permissionAllows(user.permissions, key, unitId);
      const keys = [
        "people.manage",
        "vacations.review.supervisor",
        "occurrences.review.supervisor",
      ] as const;
      if (!keys.some((key) => allowed(key)))
        return reply.code(403).send({
          code: "FORBIDDEN",
          message: "Você não pode consultar a disponibilidade da equipe.",
        });
      const units = (
        await db
          .select({ id: organizationUnits.id, name: organizationUnits.name })
          .from(organizationUnits)
          .orderBy(asc(organizationUnits.name))
      ).filter((unit) => keys.some((key) => allowed(key, unit.id)));
      const { startDate, endDate, unitId } = request.query;
      if (unitId && !units.some((unit) => unit.id === unitId))
        return reply
          .code(403)
          .send({ code: "FORBIDDEN", message: "Unidade fora do seu escopo." });
      const selected = units.filter((unit) => !unitId || unit.id === unitId);
      const managed = selected
        .filter((unit) => allowed("people.manage", unit.id))
        .map((unit) => unit.id);
      const supervised = selected
        .filter(
          (unit) =>
            allowed("vacations.review.supervisor", unit.id) ||
            allowed("occurrences.review.supervisor", unit.id),
        )
        .map((unit) => unit.id);
      const rows = await db
        .select({
          employmentId: employment.id,
          personId: people.id,
          name: people.fullName,
          unitId: employment.unitId,
          unitName: organizationUnits.name,
          jobTitle: employment.jobTitle,
          employeeNumber: employment.employeeNumber,
          supervisorId: employment.supervisorRelationshipId,
          unitActive: organizationUnits.active,
          categoryActive: employmentCategories.active,
        })
        .from(employment)
        .innerJoin(people, eq(people.id, employment.personId))
        .innerJoin(
          organizationUnits,
          eq(organizationUnits.id, employment.unitId),
        )
        .innerJoin(
          employmentCategories,
          eq(employmentCategories.id, employment.categoryId),
        )
        .where(
          and(
            isNull(employment.endDate),
            or(
              managed.length ? inArray(employment.unitId, managed) : sql`false`,
              user.employment && supervised.length
                ? and(
                    inArray(employment.unitId, supervised),
                    eq(employment.supervisorRelationshipId, user.employment.id),
                  )
                : sql`false`,
            ),
          ),
        )
        .orderBy(asc(people.fullName), asc(employment.id));
      const members = rows.map(
        ({
          employeeNumber,
          supervisorId,
          unitActive,
          categoryActive,
          ...member
        }) => ({
          ...member,
          alerts: [
            !member.jobTitle && "Função não informada",
            !employeeNumber && "Matrícula não informada",
            !supervisorId && "Chefia não informada",
            !unitActive && "Lotação inativa",
            !categoryActive && "Categoria inativa",
          ].filter((value): value is string => Boolean(value)),
        }),
      );
      const memberById = new Map(
        members.map((member) => [member.employmentId, member]),
      );
      const ids = members.map((member) => member.employmentId);
      const [vacations, absenceRows] = ids.length
        ? await Promise.all([
            db
              .select({
                id: vacationRequests.id,
                employmentId: vacationRequests.employmentRelationshipId,
                supervisorId: vacationRequests.supervisorRelationshipId,
                startDate: vacationRequests.startDate,
                endDate: vacationRequests.endDate,
                status: vacationRequests.status,
              })
              .from(vacationRequests)
              .where(
                and(
                  inArray(vacationRequests.employmentRelationshipId, ids),
                  inArray(vacationRequests.status, [
                    "submitted",
                    "final_approved",
                  ]),
                  lte(vacationRequests.startDate, endDate),
                  gte(vacationRequests.endDate, startDate),
                ),
              ),
            db
              .select({
                id: occurrences.id,
                employmentId: occurrences.employmentId,
                supervisorId: occurrences.supervisorRelationshipId,
                startDate: occurrences.startDate,
                endDate: occurrences.endDate,
                status: occurrences.status,
                typeName: occurrences.typeName,
                affectsAvailability: occurrences.affectsAvailability,
              })
              .from(occurrences)
              .where(
                and(
                  inArray(occurrences.employmentId, ids),
                  inArray(occurrences.status, ["submitted", "final_approved"]),
                  lte(occurrences.startDate, endDate),
                  gte(occurrences.endDate, startDate),
                ),
              ),
          ])
        : [[], []];
      const absences = [
        ...vacations
          .filter((item) => item.status === "final_approved")
          .map((item) => ({ ...item, reason: "Férias" })),
        ...absenceRows
          .filter(
            (item) =>
              item.status === "final_approved" && item.affectsAvailability,
          )
          .map((item) => ({ ...item, reason: item.typeName })),
      ]
        .map((item) => ({
          id: item.id,
          employmentId: item.employmentId,
          name: memberById.get(item.employmentId)!.name,
          startDate: item.startDate,
          endDate: item.endDate,
          reason: allowed(
            "people.manage",
            memberById.get(item.employmentId)!.unitId,
          )
            ? item.reason
            : "Indisponível",
        }))
        .sort(
          (a, b) =>
            a.startDate.localeCompare(b.startDate) ||
            a.name.localeCompare(b.name),
        );
      const pending = [
        ...vacations.map((item) => ({ ...item, kind: "vacation" as const })),
        ...absenceRows.map((item) => ({
          ...item,
          kind: "occurrence" as const,
        })),
      ]
        .filter(
          (item) =>
            item.status === "submitted" &&
            item.supervisorId === user.employment?.id &&
            allowed(
              item.kind === "vacation"
                ? "vacations.review.supervisor"
                : "occurrences.review.supervisor",
              memberById.get(item.employmentId)!.unitId,
            ),
        )
        .map((item) => ({
          id: item.id,
          kind: item.kind,
          name: memberById.get(item.employmentId)!.name,
          startDate: item.startDate,
          endDate: item.endDate,
        }))
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
      await db.insert(auditEvents).values({
        actorAccountId: user.account.id,
        action: "team-availability.read",
        objectType: "employment",
        outcome: "success",
        metadata: {
          startDate,
          endDate,
          unitId: unitId ?? null,
          memberCount: members.length,
        },
      });
      reply.header("Cache-Control", "no-store");
      return { units, members, absences, pending };
    },
  );
};
