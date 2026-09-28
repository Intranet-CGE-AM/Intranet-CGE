import {
  hrRequestInputSchema,
  hrRequestTransitionSchema,
  hrRequestSchema,
  hrRequestDetailSchema,
  hrRequestStatusSchema,
  hrRequestTypeSchema,
  hrRequestTypes,
  permissionAllowsGlobally,
  permissionAllows,
  permissionUnitIds,
  correctionInputSchema,
  type CorrectionSnapshot,
} from "@cge/contracts";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import { requireAuthenticatedUser } from "../access/authorize.js";
import type { AuthenticationService } from "../auth/service.js";
import { auditEvents } from "../audit/schema.js";
import { notifications } from "../notifications/schema.js";
import {
  employmentRelationships,
  people,
  organizationUnits,
  employmentCategories,
} from "../people/schema.js";
import { PeopleService } from "../people/service.js";
import { hrRequests, hrRequestEvents, hrRequestSettings } from "./schema.js";
import { delegationMetadata } from "../substitutions/active.js";

const fail = (statusCode: number, message: string) => {
  throw Object.assign(new Error(message), { statusCode });
};
const present = (row: typeof hrRequests.$inferSelect) =>
  hrRequestSchema.parse({
    ...row,
    protocol: `RH-${row.id.toUpperCase()}`,
  });

export const hrRequestRoutes: FastifyPluginAsync<{
  db: Database;
  authenticationService: AuthenticationService;
}> = async (app, { db, authenticationService }) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const peopleService = new PeopleService(db);
  api.get("/api/hr-request-settings", {}, async (request, reply) => {
    if (
      !(await requireAuthenticatedUser(request, reply, authenticationService))
    )
      return;
    const rows = await db.select().from(hrRequestSettings);
    return {
      settings: Object.keys(hrRequestTypes).map((type) => ({
        type,
        days: rows.find((row) => row.type === type)?.days ?? 5,
      })),
    };
  });
  api.put(
    "/api/hr-request-settings/:type",
    {
      schema: {
        params: z.object({ type: hrRequestTypeSchema }),
        body: z.strictObject({ days: z.number().int().min(1).max(365) }),
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      if (!permissionAllowsGlobally(user.permissions, "hr_requests.manage"))
        return fail(
          403,
          "Esta configuração exige acesso global à Gestão de Pessoas.",
        );
      await db.transaction(async (tx) => {
        await tx
          .insert(hrRequestSettings)
          .values({ type: request.params.type, days: request.body.days })
          .onConflictDoUpdate({
            target: hrRequestSettings.type,
            set: { days: request.body.days },
          });
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: "hr-request.settings-updated",
          objectType: "hr-request-settings",
          outcome: "success",
          metadata: { type: request.params.type, days: request.body.days },
        });
      });
      return { type: request.params.type, days: request.body.days };
    },
  );
  api.get(
    "/api/hr-requests",
    {
      schema: {
        querystring: z.strictObject({
          scope: z.enum(["mine", "team"]).default("mine"),
          status: hrRequestStatusSchema.optional(),
          page: z.coerce.number().int().min(1).default(1),
        }),
        response: {
          200: z.object({
            requests: z.array(hrRequestSchema),
            hasMore: z.boolean(),
          }),
        },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const team = request.query.scope === "team";
      if (team && !permissionAllows(user.permissions, "hr_requests.manage"))
        fail(403, "Você não possui acesso à fila da Gestão de Pessoas.");
      const units = permissionUnitIds(user.permissions, "hr_requests.manage");
      const rows = await db
        .select()
        .from(hrRequests)
        .where(
          and(
            team
              ? units === null
                ? undefined
                : units.length
                  ? inArray(hrRequests.unitId, units)
                  : sql`false`
              : eq(hrRequests.requesterAccountId, user.account.id),
            request.query.status
              ? eq(hrRequests.status, request.query.status)
              : undefined,
          ),
        )
        .orderBy(desc(hrRequests.createdAt), desc(hrRequests.id))
        .limit(51)
        .offset((request.query.page - 1) * 50);
      return reply.header("Cache-Control", "no-store").send({
        requests: rows.slice(0, 50).map(present),
        hasMore: rows.length > 50,
      });
    },
  );
  api.get(
    "/api/hr-requests/:id",
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        response: { 200: hrRequestDetailSchema },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const [item] = await db
        .select()
        .from(hrRequests)
        .where(eq(hrRequests.id, request.params.id));
      if (
        !item ||
        (item.requesterAccountId !== user.account.id &&
          !permissionAllows(
            user.permissions,
            "hr_requests.manage",
            item.unitId,
          ))
      )
        return fail(404, "Solicitação não encontrada.");
      const events = await db
        .select()
        .from(hrRequestEvents)
        .where(eq(hrRequestEvents.requestId, item.id))
        .orderBy(hrRequestEvents.version);
      return reply
        .header("Cache-Control", "no-store")
        .send({ ...present(item), events });
    },
  );
  api.post(
    "/api/hr-requests",
    { schema: { body: hrRequestInputSchema } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const item = await db.transaction(async (tx) => {
        const [person] = await tx
          .select()
          .from(people)
          .where(eq(people.id, user.person.id))
          .for("update");
        if (!person) return fail(404, "Cadastro não encontrado.");
        const [employment] = await tx
          .select()
          .from(employmentRelationships)
          .where(
            and(
              eq(employmentRelationships.personId, user.person.id),
              isNull(employmentRelationships.endDate),
            ),
          )
          .for("update");
        if (!employment)
          return fail(
            400,
            "Procure a Gestão de Pessoas para revisar seu vínculo ativo.",
          );
        if (
          !permissionAllows(
            user.permissions,
            "hr_requests.create",
            employment.unitId,
          )
        )
          return fail(
            403,
            "Você não possui permissão para abrir solicitações.",
          );
        let correction: CorrectionSnapshot | null = null;
        if (request.body.correction) {
          const proposed: Record<string, unknown> = {};
          const previous: Record<string, unknown> = {};
          for (const field of [
            "fullName",
            "preferredName",
            "birthDate",
          ] as const) {
            const value = request.body.correction[field];
            if (value !== undefined && value !== person[field]) {
              proposed[field] = value;
              previous[field] = person[field];
            }
          }
          const nextEmployment: Record<string, unknown> = {};
          const oldEmployment: Record<string, unknown> = {};
          for (const field of [
            "jobTitle",
            "categoryId",
            "unitId",
            "supervisorRelationshipId",
          ] as const) {
            const value = request.body.correction.employment?.[field];
            if (value !== undefined && value !== employment[field]) {
              nextEmployment[field] = value;
              oldEmployment[field] = employment[field];
            }
          }
          if (Object.keys(nextEmployment).length) {
            proposed.employment = nextEmployment;
            previous.employment = oldEmployment;
          }
          if (!Object.keys(proposed).length)
            return fail(
              400,
              "Informe pelo menos um campo diferente do cadastro atual.",
            );
          correction = {
            proposed: correctionInputSchema.parse(proposed),
            previous: correctionInputSchema.parse(previous),
            employmentVersion: employment.version,
            display: {},
          };
          for (const field of [
            "unitId",
            "categoryId",
            "supervisorRelationshipId",
          ] as const) {
            if (!(field in nextEmployment)) continue;
            const ids = [nextEmployment[field], oldEmployment[field]].filter(
              (id): id is string => typeof id === "string",
            );
            const rows = !ids.length
              ? []
              : field === "supervisorRelationshipId"
                ? await tx
                    .select({
                      id: employmentRelationships.id,
                      name: people.fullName,
                      active: sql<boolean>`${employmentRelationships.endDate} is null`,
                    })
                    .from(employmentRelationships)
                    .innerJoin(
                      people,
                      eq(people.id, employmentRelationships.personId),
                    )
                    .where(inArray(employmentRelationships.id, ids))
                : field === "unitId"
                  ? await tx
                      .select({
                        id: organizationUnits.id,
                        name: organizationUnits.name,
                        active: organizationUnits.active,
                      })
                      .from(organizationUnits)
                      .where(inArray(organizationUnits.id, ids))
                  : await tx
                      .select({
                        id: employmentCategories.id,
                        name: employmentCategories.name,
                        active: employmentCategories.active,
                      })
                      .from(employmentCategories)
                      .where(inArray(employmentCategories.id, ids));
            const next = rows.find((row) => row.id === nextEmployment[field]);
            if (
              nextEmployment[field] !== null &&
              (!next?.active ||
                (field === "supervisorRelationshipId" &&
                  next.id === employment.id))
            )
              return fail(
                400,
                "Selecione uma referência ativa e válida para a correção.",
              );
            correction.display[field] = {
              previous:
                rows.find((row) => row.id === oldEmployment[field])?.name ??
                "Não informado",
              proposed: next?.name ?? "Não informado",
            };
          }
        }
        const [setting] = await tx
          .select()
          .from(hrRequestSettings)
          .where(eq(hrRequestSettings.type, request.body.type));
        const [created] = await tx
          .insert(hrRequests)
          .values({
            ...request.body,
            correction,
            requesterAccountId: user.account.id,
            requesterName: user.person.displayName,
            employmentId: employment.id,
            unitId: employment.unitId,
            dueAt: new Date(Date.now() + (setting?.days ?? 5) * 86_400_000),
          })
          .returning();
        if (!created) throw new Error("Request was not created");
        await tx.insert(hrRequestEvents).values({
          requestId: created.id,
          version: 1,
          actorAccountId: user.account.id,
          actorName: user.person.displayName,
          type: "submitted",
        });
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: "hr-request.submitted",
          objectType: "hr-request",
          objectId: created.id,
          outcome: "success",
        });
        return created;
      });
      return reply.status(201).send(present(item));
    },
  );
  api.post(
    "/api/hr-requests/:id/transition",
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: hrRequestTransitionSchema,
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const { action, version, message, deadline } = request.body;
      const item = await db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(hrRequests)
          .where(eq(hrRequests.id, request.params.id))
          .for("update");
        if (!current) return fail(404, "Solicitação não encontrada.");
        if (
          ["cancel", "provide_information"].includes(action)
            ? current.requesterAccountId !== user.account.id
            : !permissionAllows(
                user.permissions,
                "hr_requests.manage",
                current.unitId,
              )
        )
          return fail(403, "Você não possui permissão para esta ação.");
        if (current.version !== version)
          return fail(
            409,
            "Esta solicitação foi atualizada. Recarregue antes de continuar.",
          );
        if (
          (["start", "cancel"].includes(action) &&
            current.status !== "submitted") ||
          ([
            "complete",
            "reject",
            "request_information",
            "provide_information",
          ].includes(action) &&
            current.status !== "in_analysis")
        )
          return fail(
            409,
            "Esta ação não está disponível na etapa atual. Recarregue a solicitação.",
          );
        if (action === "provide_information" && !current.informationDeadline)
          return fail(409, "Não há complemento pendente.");
        if (
          action === "request_information" &&
          deadline &&
          deadline <
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "America/Manaus",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date())
        )
          return fail(400, "O prazo não pode estar no passado.");
        const status = {
          start: "in_analysis",
          complete: "completed",
          reject: "rejected",
          cancel: "cancelled",
          request_information: "in_analysis",
          provide_information: "in_analysis",
        }[action];
        if (action === "complete" && current.type === "correction") {
          if (!current.correction)
            return fail(
              409,
              "Esta solicitação antiga não contém uma proposta estruturada. Solicite uma nova correção.",
            );
          const [relationship] = await tx
            .select({ personId: employmentRelationships.personId })
            .from(employmentRelationships)
            .where(eq(employmentRelationships.id, current.employmentId));
          if (!relationship) return fail(409, "Vínculo não encontrado.");
          const [person] = await tx
            .select()
            .from(people)
            .where(eq(people.id, relationship.personId))
            .for("update");
          const [employment] = await tx
            .select()
            .from(employmentRelationships)
            .where(eq(employmentRelationships.id, current.employmentId))
            .for("update");
          if (
            !person ||
            !employment ||
            employment.endDate ||
            employment.version !== current.correction.employmentVersion
          )
            return fail(
              409,
              "O cadastro foi alterado. Solicite uma proposta atualizada.",
            );
          if (
            !permissionAllows(
              user.permissions,
              "people.manage",
              current.unitId,
            ) ||
            !permissionAllows(
              user.permissions,
              "people.manage",
              employment.unitId,
            ) ||
            (current.correction.proposed.employment?.unitId &&
              !permissionAllows(
                user.permissions,
                "people.manage",
                current.correction.proposed.employment.unitId,
              ))
          )
            return fail(
              403,
              "A aprovação exige permissão de cadastro nas unidades de origem e destino.",
            );
          for (const field of [
            "fullName",
            "preferredName",
            "birthDate",
          ] as const) {
            if (
              current.correction.previous[field] !== undefined &&
              current.correction.previous[field] !== person[field]
            )
              return fail(
                409,
                "O cadastro foi alterado. Solicite uma proposta atualizada.",
              );
          }
          const effectiveOn = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Manaus",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date());
          await peopleService.updatePerson(
            person.id,
            current.correction.proposed,
            {
              actorAccountId: user.account.id,
              permissions: user.permissions,
              permission: "people.manage",
              reason: `Correção aprovada na solicitação RH-${current.id}: ${message}`,
              effectiveOn,
              expectedVersion: current.correction.employmentVersion,
            },
            tx,
          );
          await tx.insert(auditEvents).values({
            actorAccountId: user.account.id,
            action: "person.correction-approved",
            objectType: "person",
            objectId: person.id,
            outcome: "success",
            metadata: {
              requestId: current.id,
              fields: [
                ...Object.keys(current.correction.proposed).filter(
                  (key) => key !== "employment",
                ),
                ...Object.keys(
                  current.correction.proposed.employment ?? {},
                ).map((key) => `employment.${key}`),
              ],
            },
          });
        }
        const [updated] = await tx
          .update(hrRequests)
          .set({
            status,
            version: version + 1,
            updatedAt: new Date(),
            ...(action === "request_information"
              ? { informationMessage: message, informationDeadline: deadline }
              : {}),
            ...(["provide_information", "complete", "reject"].includes(action)
              ? { informationMessage: null, informationDeadline: null }
              : {}),
            ...(action === "start"
              ? { assigneeAccountId: user.account.id }
              : {}),
            ...(["complete", "reject"].includes(action)
              ? { response: message }
              : {}),
          })
          .where(eq(hrRequests.id, current.id))
          .returning();
        if (!updated) throw new Error("Request was not updated");
        await tx.insert(hrRequestEvents).values({
          requestId: current.id,
          version: version + 1,
          actorAccountId: user.account.id,
          actorName: user.person.displayName,
          type: action,
          message,
        });
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: `hr-request.${action}`,
          objectType: "hr-request",
          objectId: current.id,
          outcome: "success",
          metadata: ["cancel", "provide_information"].includes(action)
            ? undefined
            : delegationMetadata(
                user.permissions,
                "hr_requests.manage",
                current.unitId,
              ),
        });
        if (user.account.id !== current.requesterAccountId) {
          await tx
            .insert(notifications)
            .values({
              accountId: current.requesterAccountId,
              type: `hr-request.${action}`,
              title:
                action === "request_information"
                  ? "RH solicitou informações"
                  : "Sua solicitação de RH foi atualizada",
              href: `/rh/solicitacoes?requestId=${current.id}`,
              dedupeKey: `hr-request:${current.id}:${version + 1}`,
            })
            .onConflictDoNothing();
        }
        return updated;
      });
      return present(item);
    },
  );
};
