import {
  authErrorSchema,
  hrMetricsQuerySchema,
  hrMetricsSchema,
  permissionAllows,
  type PermissionKey,
} from "@cge/contracts";
import {
  and,
  asc,
  count,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  sql,
  type SQL,
} from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Database } from "../../db/client.js";
import { requireAuthenticatedUser } from "../access/authorize.js";
import type { AuthenticationService } from "../auth/service.js";
import { hrRequests } from "../hr-requests/schema.js";
import { occurrences } from "../occurrences/schema.js";
import { vacationRequests } from "../vacations/schema.js";
import { trainingRecords } from "../training/schema.js";
import { fieldProvenance } from "./history-schema.js";
import {
  employmentRelationships as employment,
  organizationUnits,
} from "./schema.js";

export const metricsRoutes: FastifyPluginAsync<{
  db: Database;
  authenticationService: AuthenticationService;
}> = async (app, { db, authenticationService }) => {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/api/hr-metrics",
    {
      schema: {
        querystring: hrMetricsQuerySchema,
        response: { 200: hrMetricsSchema, 403: authErrorSchema },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const keys = [
        "hr_requests.manage",
        "occurrences.review.final",
        "vacations.review.final",
        "training.review",
        "people.manage",
      ] as const;
      if (!keys.some((key) => permissionAllows(user.permissions, key)))
        return reply.code(403).send({
          code: "FORBIDDEN",
          message:
            "Você não possui acesso aos indicadores de Gestão de Pessoas.",
        });
      const units = (
        await db
          .select({ id: organizationUnits.id, name: organizationUnits.name })
          .from(organizationUnits)
          .orderBy(asc(organizationUnits.name))
      ).filter((unit) =>
        keys.some((key) => permissionAllows(user.permissions, key, unit.id)),
      );
      const { startDate, endDate, unitId } = request.query;
      if (unitId && !units.some((unit) => unit.id === unitId))
        return reply
          .code(403)
          .send({ code: "FORBIDDEN", message: "Unidade fora do seu escopo." });
      // Datas administrativas de Manaus; limite superior exclusivo inclui o último dia inteiro.
      const start = new Date(`${startDate}T00:00:00-04:00`);
      const end = new Date(
        new Date(`${endDate}T00:00:00-04:00`).getTime() + 86400000,
      );
      const period = (column: PgColumn) =>
        and(gte(column, start), lt(column, end));
      const scope = (key: PermissionKey, column: PgColumn): SQL | null => {
        const selected = units.filter(
          (unit) =>
            (!unitId || unit.id === unitId) &&
            permissionAllows(user.permissions, key, unit.id),
        );
        return selected.length
          ? inArray(
              column,
              selected.map((unit) => unit.id),
            )
          : null;
      };
      // Cada indicador segue a mesma lotação usada pela fila correspondente.
      const requestsScope = scope("hr_requests.manage", hrRequests.unitId);
      const occurrenceScope = scope(
        "occurrences.review.final",
        employment.unitId,
      );
      const vacationScope = scope("vacations.review.final", employment.unitId);
      const trainingScope = scope("training.review", employment.unitId);
      const peopleScope = scope("people.manage", employment.unitId);
      const [
        requests,
        completion,
        absenceStates,
        vacationStates,
        training,
        divergence,
      ] = await Promise.all([
        requestsScope
          ? db
              .select({
                type: hrRequests.type,
                status: hrRequests.status,
                count: count(),
              })
              .from(hrRequests)
              .where(and(requestsScope, period(hrRequests.createdAt)))
              .groupBy(hrRequests.type, hrRequests.status)
              .orderBy(asc(hrRequests.type), asc(hrRequests.status))
          : null,
        requestsScope
          ? db
              .select({
                count: count(),
                averageHours: sql<
                  number | null
                >`avg(extract(epoch from (${hrRequests.updatedAt} - ${hrRequests.createdAt})) / 3600)::float8`,
              })
              .from(hrRequests)
              .where(
                and(
                  requestsScope,
                  eq(hrRequests.status, "completed"),
                  period(hrRequests.updatedAt),
                ),
              )
          : null,
        occurrenceScope
          ? db
              .select({ status: occurrences.status, count: count() })
              .from(occurrences)
              .innerJoin(
                employment,
                eq(employment.id, occurrences.employmentId),
              )
              .where(and(occurrenceScope, period(occurrences.createdAt)))
              .groupBy(occurrences.status)
              .orderBy(asc(occurrences.status))
          : null,
        vacationScope
          ? db
              .select({ status: vacationRequests.status, count: count() })
              .from(vacationRequests)
              .innerJoin(
                employment,
                eq(employment.id, vacationRequests.employmentRelationshipId),
              )
              .where(
                and(
                  vacationScope,
                  inArray(vacationRequests.status, [
                    "submitted",
                    "supervisor_approved",
                  ]),
                  period(vacationRequests.createdAt),
                ),
              )
              .groupBy(vacationRequests.status)
              .orderBy(asc(vacationRequests.status))
          : null,
        trainingScope
          ? db
              .select({ count: count() })
              .from(trainingRecords)
              .innerJoin(
                employment,
                eq(employment.id, trainingRecords.employmentId),
              )
              .where(
                and(
                  trainingScope,
                  eq(trainingRecords.status, "submitted"),
                  period(trainingRecords.createdAt),
                ),
              )
          : null,
        peopleScope
          ? db
              .select({ count: count() })
              .from(fieldProvenance)
              .innerJoin(
                employment,
                eq(employment.personId, fieldProvenance.personId),
              )
              .where(
                and(
                  peopleScope,
                  isNull(employment.endDate),
                  isNotNull(fieldProvenance.syncedAt),
                  sql`${fieldProvenance.value} is distinct from ${fieldProvenance.externalValue}`,
                  period(fieldProvenance.updatedAt),
                ),
              )
          : null,
      ]);
      return reply.header("Cache-Control", "no-store").send({
        units,
        requests,
        completion: completion?.[0] ?? null,
        occurrences: absenceStates,
        vacations: vacationStates,
        trainingPending: training?.[0]?.count ?? null,
        divergences: divergence?.[0]?.count ?? null,
      });
    },
  );
};
