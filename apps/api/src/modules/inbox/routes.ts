import {
  inboxQuerySchema,
  inboxSchema,
  permissionAllows,
  type InboxItem,
  type PermissionKey,
} from "@cge/contracts";
import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Database } from "../../db/client.js";
import { requireAuthenticatedUser } from "../access/authorize.js";
import type { AuthenticationService } from "../auth/service.js";
import { auditEvents } from "../audit/schema.js";
import { hrRequests } from "../hr-requests/schema.js";
import {
  organizationUnits,
  employmentRelationships as employment,
  people,
} from "../people/schema.js";
import { occurrences } from "../occurrences/schema.js";
import { checklists } from "../onboarding/schema.js";
import { trainingRecords } from "../training/schema.js";
import { vacationRequests } from "../vacations/schema.js";
import {
  activeSubstitutions,
  checklistDelegations,
} from "../substitutions/active.js";
import type { AccessService } from "../access/service.js";
import { occurrenceChiefAuthority } from "../occurrences/authority.js";

export const inboxRoutes: FastifyPluginAsync<{
  db: Database;
  authenticationService: AuthenticationService;
  accessService: AccessService;
}> = async (app, { db, authenticationService, accessService }) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  api.get(
    "/api/inbox",
    {
      schema: { querystring: inboxQuerySchema, response: { 200: inboxSchema } },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const allUnits = await db
        .select({ id: organizationUnits.id, name: organizationUnits.name })
        .from(organizationUnits);
      function scope(permission: PermissionKey, column: AnyPgColumn) {
        const ids = allUnits
          .filter((unit) =>
            permissionAllows(user!.permissions, permission, unit.id),
          )
          .map((unit) => unit.id);
        return ids.length ? inArray(column, ids) : sql`false`;
      }
      const names = new Map(allUnits.map((unit) => [unit.id, unit.name]));
      const outgoing = await Promise.all(
        (await activeSubstitutions(db, user.account.id))
          .filter((item) => item.record.originalAccountId === user.account.id)
          .map(async (item) => {
            const grants = await accessService.resolvePermissions(
              item.record.substituteAccountId,
            );
            return {
              ...item,
              record: {
                ...item.record,
                flows: item.record.flows.filter(
                  (flow) =>
                    flow === "checklist.assignment" ||
                    grants.some(
                      (grant) =>
                        grant.key === flow &&
                        grant.delegation?.id === item.record.id &&
                        permissionAllows(grants, grant.key, item.record.unitId),
                    ),
                ),
              },
            };
          }),
      );
      const items: InboxItem[] = [];
      const sourcesUnavailable: InboxItem["type"][] = [];
      function append(
        item: Omit<InboxItem, "unitName" | "priority">,
        flow?: PermissionKey,
      ) {
        if (
          flow &&
          outgoing.some(
            (entry) =>
              entry.record.unitId === item.unitId &&
              entry.record.flows.includes(flow),
          )
        )
          return;
        const delegation =
          item.delegation ??
          (flow
            ? user!.permissions.find(
                (grant) =>
                  grant.key === flow &&
                  grant.unitId === item.unitId &&
                  grant.delegation,
              )?.delegation
            : undefined);
        items.push({
          ...item,
          ...(delegation ? { delegation } : {}),
          unitName: names.get(item.unitId) ?? "Unidade",
          priority: item.dueAt && item.dueAt < new Date() ? "urgent" : "normal",
        });
      }
      async function source(
        type: InboxItem["type"],
        read: () => Promise<void>,
      ) {
        if (request.query.type && request.query.type !== type) return;
        try {
          await read();
        } catch (cause) {
          request.log.error(
            { err: cause, source: type },
            "Inbox source unavailable",
          );
          sourcesUnavailable.push(type);
          await db.insert(auditEvents).values({
            actorAccountId: user!.account.id,
            action: "inbox.source-unavailable",
            objectType: "inbox",
            outcome: "failure",
            metadata: { source: type },
          });
        }
      }
      await source("request", async () => {
        const rows = await db
          .select({
            id: hrRequests.id,
            requesterName: hrRequests.requesterName,
            requesterAccountId: hrRequests.requesterAccountId,
            unitId: hrRequests.unitId,
            createdAt: hrRequests.createdAt,
            dueAt: hrRequests.dueAt,
            informationDeadline: hrRequests.informationDeadline,
            status: hrRequests.status,
          })
          .from(hrRequests)
          .where(
            or(
              and(
                eq(hrRequests.requesterAccountId, user.account.id),
                eq(hrRequests.status, "in_analysis"),
                isNotNull(hrRequests.informationDeadline),
              ),
              and(
                scope("hr_requests.manage", hrRequests.unitId),
                inArray(hrRequests.status, ["submitted", "in_analysis"]),
                isNull(hrRequests.informationDeadline),
              ),
            ),
          );
        for (const row of rows) {
          const ownComplement =
            row.requesterAccountId === user.account.id &&
            Boolean(row.informationDeadline);
          const dueAt = ownComplement
            ? new Date(`${row.informationDeadline}T23:59:59.999-04:00`)
            : row.dueAt;
          append(
            {
              id: `request:${row.id}`,
              type: "request",
              title: ownComplement
                ? "Enviar complemento ao RH"
                : row.status === "submitted"
                  ? "Analisar solicitação"
                  : "Responder solicitação",
              context: ownComplement
                ? "O RH aguarda suas informações."
                : `${row.requesterName} · RH-${row.id.toUpperCase()}`,
              unitId: row.unitId,
              createdAt: row.createdAt,
              dueAt,
              href: `/rh/solicitacoes?${ownComplement ? "" : "scope=team&"}requestId=${row.id}`,
            },
            ownComplement ? undefined : "hr_requests.manage",
          );
        }
      });
      await Promise.all([
        source("vacation", async () => {
          const delegatedChiefs = user.permissions.filter(
            (grant) =>
              grant.key === "vacations.review.supervisor" &&
              grant.delegation &&
              grant.unitId &&
              permissionAllows(user.permissions, grant.key, grant.unitId),
          );
          // A chefia congelada pode ser um vínculo anterior da mesma pessoa, como na fila de férias.
          const supervisorIds = await db
            .select({ id: employment.id, personId: employment.personId })
            .from(employment)
            .where(
              inArray(employment.personId, [
                user.person.id,
                ...delegatedChiefs.map(
                  (grant) => grant.delegation!.originalPersonId,
                ),
              ]),
            );
          const rows = await db
            .select({
              id: vacationRequests.id,
              name: people.fullName,
              requesterPersonId: people.id,
              unitId: employment.unitId,
              status: vacationRequests.status,
              startDate: vacationRequests.startDate,
              createdAt: vacationRequests.createdAt,
              supervisorRelationshipId:
                vacationRequests.supervisorRelationshipId,
            })
            .from(vacationRequests)
            .innerJoin(
              employment,
              eq(employment.id, vacationRequests.employmentRelationshipId),
            )
            .innerJoin(people, eq(people.id, employment.personId))
            .where(
              or(
                and(
                  eq(vacationRequests.status, "submitted"),
                  supervisorIds.length
                    ? or(
                        ...supervisorIds.map((chief) =>
                          and(
                            eq(
                              vacationRequests.supervisorRelationshipId,
                              chief.id,
                            ),
                            chief.personId === user.person.id
                              ? (() => {
                                  const units = allUnits
                                    .filter((unit) =>
                                      permissionAllows(
                                        user.permissions.filter(
                                          (grant) => !grant.delegation,
                                        ),
                                        "vacations.review.supervisor",
                                        unit.id,
                                      ),
                                    )
                                    .map((unit) => unit.id);
                                  return units.length
                                    ? inArray(employment.unitId, units)
                                    : sql`false`;
                                })()
                              : or(
                                  ...delegatedChiefs
                                    .filter(
                                      (grant) =>
                                        grant.delegation!.originalPersonId ===
                                        chief.personId,
                                    )
                                    .map((grant) =>
                                      eq(employment.unitId, grant.unitId!),
                                    ),
                                ),
                          ),
                        ),
                      )
                    : sql`false`,
                  scope("vacations.review.supervisor", employment.unitId),
                ),
                and(
                  eq(vacationRequests.status, "supervisor_approved"),
                  scope("vacations.review.final", employment.unitId),
                ),
              ),
            );
          for (const row of rows) {
            const chief = supervisorIds.find(
              (item) => item.id === row.supervisorRelationshipId,
            );
            const flow =
              row.status === "submitted"
                ? "vacations.review.supervisor"
                : "vacations.review.final";
            if (
              outgoing.some(
                (item) =>
                  chief?.personId === user.person.id &&
                  item.substitutePersonId !== row.requesterPersonId &&
                  item.record.unitId === row.unitId &&
                  item.record.flows.includes(flow),
              )
            )
              continue;
            const delegation =
              row.status === "submitted"
                ? delegatedChiefs.find(
                    (grant) =>
                      grant.unitId === row.unitId &&
                      grant.delegation!.originalPersonId === chief?.personId,
                  )?.delegation
                : undefined;
            if (delegation && row.requesterPersonId === user.person.id)
              continue;
            append(
              {
                ...(delegation ? { delegation } : {}),
                id: `vacation:${row.id}`,
                type: "vacation",
                title:
                  row.status === "submitted"
                    ? "Analisar férias como chefia"
                    : "Registrar decisão final de férias",
                context: row.name,
                unitId: row.unitId,
                createdAt: row.createdAt,
                dueAt: new Date(`${row.startDate}T00:00:00-04:00`),
                href: `/rh/ferias?requestId=${row.id}`,
              },
              row.status === "supervisor_approved"
                ? "vacations.review.final"
                : undefined,
            );
          }
        }),
        source("occurrence", async () => {
          const chief = await occurrenceChiefAuthority(db, user);
          const rows = await db
            .select({
              id: occurrences.id,
              name: occurrences.requesterName,
              unitId: employment.unitId,
              status: occurrences.status,
              startDate: occurrences.startDate,
              createdAt: occurrences.createdAt,
              supervisorRelationshipId: occurrences.supervisorRelationshipId,
              requesterAccountId: occurrences.requesterAccountId,
            })
            .from(occurrences)
            .innerJoin(employment, eq(employment.id, occurrences.employmentId))
            .where(
              or(
                and(eq(occurrences.status, "submitted"), chief.where),
                and(
                  eq(occurrences.status, "supervisor_approved"),
                  scope("occurrences.review.final", employment.unitId),
                ),
              ),
            );
          for (const row of rows) {
            if (
              row.status === "submitted" &&
              row.supervisorRelationshipId === user.employment?.id &&
              outgoing.some(
                (entry) =>
                  entry.record.unitId === row.unitId &&
                  entry.record.flows.includes(
                    "occurrences.review.supervisor",
                  ) &&
                  entry.record.substituteAccountId !== row.requesterAccountId,
              )
            )
              continue;
            const delegation =
              row.status === "submitted"
                ? chief.match(row, row.unitId).delegation
                : undefined;
            append(
              {
                id: `occurrence:${row.id}`,
                ...(delegation ? { delegation } : {}),
                type: "occurrence",
                title:
                  row.status === "submitted"
                    ? "Analisar ocorrência como chefia"
                    : "Registrar decisão final da ocorrência",
                context: row.name,
                unitId: row.unitId,
                createdAt: row.createdAt,
                dueAt: new Date(`${row.startDate}T00:00:00-04:00`),
                href: `/rh/ocorrencias?scope=${row.status === "submitted" ? "supervisor" : "final"}&occurrenceId=${row.id}`,
              },
              row.status === "submitted"
                ? undefined
                : "occurrences.review.final",
            );
          }
        }),
        source("training", async () => {
          const rows = await db
            .select({
              id: trainingRecords.id,
              name: trainingRecords.requesterName,
              unitId: employment.unitId,
              createdAt: trainingRecords.createdAt,
            })
            .from(trainingRecords)
            .innerJoin(
              employment,
              eq(employment.id, trainingRecords.employmentId),
            )
            .where(
              and(
                eq(trainingRecords.status, "submitted"),
                scope("training.review", employment.unitId),
              ),
            );
          for (const row of rows)
            append(
              {
                id: `training:${row.id}`,
                type: "training",
                title: "Validar capacitação",
                context: row.name,
                unitId: row.unitId,
                createdAt: row.createdAt,
                dueAt: null,
                href: `/rh/capacitacoes?scope=review&trainingId=${row.id}`,
              },
              "training.review",
            );
        }),
        source("checklist", async () => {
          const delegated = await checklistDelegations(db, user.account.id);
          const rows = await db
            .select({
              id: checklists.id,
              name: checklists.name,
              personName: checklists.personName,
              unitId: employment.unitId,
              createdAt: checklists.createdAt,
              items: checklists.items,
            })
            .from(checklists)
            .innerJoin(employment, eq(employment.id, checklists.employmentId))
            .where(
              and(
                sql`${checklists.items} @> '[{"status":"pending"}]'::jsonb`,
                or(
                  scope("onboarding.manage", employment.unitId),
                  sql`${checklists.items} @> ${JSON.stringify([{ assigneeAccountId: user.account.id, status: "pending" }])}::jsonb`,
                  ...delegated.map((entry) =>
                    and(
                      eq(employment.unitId, entry.unitId),
                      sql`${checklists.items} @> ${JSON.stringify([{ assigneeAccountId: entry.delegation.originalAccountId, status: "pending" }])}::jsonb`,
                    ),
                  ),
                ),
              ),
            );
          for (const row of rows) {
            const manages =
              permissionAllows(
                user.permissions,
                "onboarding.manage",
                row.unitId,
              ) &&
              !outgoing.some(
                (entry) =>
                  entry.record.unitId === row.unitId &&
                  entry.record.flows.includes("onboarding.manage"),
              );
            const forwarded = outgoing.some(
              (entry) =>
                entry.record.unitId === row.unitId &&
                entry.record.flows.includes("checklist.assignment"),
            );
            const delegation = delegated.find(
              (entry) =>
                entry.unitId === row.unitId &&
                row.items.some(
                  (item) =>
                    item.status === "pending" &&
                    item.assigneeAccountId ===
                      entry.delegation.originalAccountId,
                ),
            )?.delegation;
            const pending = row.items.filter(
              (item) =>
                item.status === "pending" &&
                ((item.assigneeAccountId === user.account.id && !forwarded) ||
                  manages ||
                  delegated.some(
                    (entry) =>
                      entry.unitId === row.unitId &&
                      entry.delegation.originalAccountId ===
                        item.assigneeAccountId,
                  )),
            ).length;
            if (!pending) continue;
            append(
              {
                id: `checklist:${row.id}`,
                ...(delegation ? { delegation } : {}),
                type: "checklist",
                title: "Concluir providências do checklist",
                context: `${row.personName} · ${row.name} · ${pending} pendente(s)`,
                unitId: row.unitId,
                createdAt: row.createdAt,
                dueAt: null,
                href: `/rh/checklists?checklistId=${row.id}`,
              },
              manages ? "onboarding.manage" : undefined,
            );
          }
        }),
      ]);
      const units = allUnits
        .filter((unit) => items.some((item) => item.unitId === unit.id))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      // ponytail: ordena somente pendências ativas em memória; migrar para UNION SQL se o volume operacional exigir.
      const selected = items
        .filter(
          (item) =>
            (!request.query.type || item.type === request.query.type) &&
            (!request.query.unitId || item.unitId === request.query.unitId),
        )
        .sort(
          (a, b) =>
            Number(b.priority === "urgent") - Number(a.priority === "urgent") ||
            a.createdAt.getTime() - b.createdAt.getTime() ||
            (a.dueAt?.getTime() ?? Infinity) -
              (b.dueAt?.getTime() ?? Infinity) ||
            a.id.localeCompare(b.id),
        );
      const offset = (request.query.page - 1) * request.query.pageSize;
      return reply.header("Cache-Control", "no-store").send({
        items: selected.slice(offset, offset + request.query.pageSize),
        total: selected.length,
        hasMore: offset + request.query.pageSize < selected.length,
        sourcesUnavailable: sourcesUnavailable.sort(),
        units,
      });
    },
  );
};
