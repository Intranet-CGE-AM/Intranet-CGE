import {
  occurrenceInputSchema,
  occurrenceTypeInputSchema,
  occurrenceTransitionSchema,
  occurrenceSchema,
  permissionAllows,
  permissionAllowsGlobally,
  permissionUnitIds,
  type AuthenticatedUser,
  type OccurrenceTypeInput,
} from "@cge/contracts";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  sql,
  getTableColumns,
} from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Database, Transaction } from "../../db/client.js";
import { requireAuthenticatedUser } from "../access/authorize.js";
import type { AuthenticationService } from "../auth/service.js";
import { auditEvents } from "../audit/schema.js";
import { documentTypes, functionalDocuments } from "../documents/schema.js";
import { employmentRelationships, people } from "../people/schema.js";
import { userAccounts } from "../auth/schema.js";
import { occurrenceTypes, occurrences, occurrenceEvents } from "./schema.js";
import { notifications } from "../notifications/schema.js";
import { assertAvailablePeriod } from "../vacations/availability.js";
import { occurrenceChiefAuthority } from "./authority.js";
import { delegationMetadata } from "../substitutions/active.js";

function fail(statusCode: number, message: string): never {
  throw Object.assign(new Error(message), { statusCode });
}

function present(item: typeof occurrences.$inferSelect, privateView: boolean) {
  return occurrenceSchema.parse({
    id: item.id,
    typeName: item.typeName,
    requesterName: item.requesterName,
    requesterAccountId: item.requesterAccountId,
    startDate: item.startDate,
    endDate: item.endDate,
    status: item.status,
    version: item.version,
    affectsAvailability: item.affectsAvailability,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    ...(privateView
      ? {
          justification: item.justification,
          documentId: item.documentId,
          requiresDocument: item.requiresDocument,
          documentTypeId: item.documentTypeId,
        }
      : {}),
  });
}

export const occurrenceRoutes: FastifyPluginAsync<{
  db: Database;
  authenticationService: AuthenticationService;
}> = async (app, { db, authenticationService }) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  async function access(
    user: AuthenticatedUser,
    item: typeof occurrences.$inferSelect,
    tx: Database | Transaction = db,
  ) {
    const [employment] = await tx
      .select()
      .from(employmentRelationships)
      .where(eq(employmentRelationships.id, item.employmentId));
    const unitId = employment?.unitId ?? item.unitId;
    const own = item.requesterAccountId === user.account.id;
    const final = permissionAllows(
      user.permissions,
      "occurrences.review.final",
      unitId,
    );
    const chief = (await occurrenceChiefAuthority(tx, user)).match(
      item,
      unitId,
    );
    const supervisor = chief.allowed;
    const privateView =
      own ||
      (final &&
        permissionAllows(user.permissions, "documents.sensitive.read", unitId));
    return {
      own,
      final,
      supervisor,
      privateView,
      unitId,
      employment,
      delegation: chief.delegation,
    };
  }
  async function checkDocumentPolicy(
    tx: Transaction,
    input: OccurrenceTypeInput,
  ) {
    if (!input.documentTypeId) return;
    const [type] = await tx
      .select()
      .from(documentTypes)
      .where(eq(documentTypes.id, input.documentTypeId));
    if (!type) fail(400, "Política documental não encontrada.");
  }
  api.get("/api/occurrence-types", {}, async (request, reply) => {
    const user = await requireAuthenticatedUser(
      request,
      reply,
      authenticationService,
    );
    if (!user) return;
    return {
      documentTypes: permissionAllowsGlobally(
        user.permissions,
        "occurrences.manage_types",
      )
        ? await db.select().from(documentTypes).orderBy(documentTypes.name)
        : [],
      types: await db
        .select()
        .from(occurrenceTypes)
        .orderBy(occurrenceTypes.name),
    };
  });
  api.post(
    "/api/occurrence-types",
    { schema: { body: occurrenceTypeInputSchema } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      if (
        !permissionAllowsGlobally(user.permissions, "occurrences.manage_types")
      )
        fail(403, "Você não pode administrar tipos de ocorrência.");
      const created = await db.transaction(async (tx) => {
        await checkDocumentPolicy(tx, request.body);
        const [item] = await tx
          .insert(occurrenceTypes)
          .values(request.body)
          .returning();
        if (!item) throw new Error("Occurrence type not created");
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: "occurrence-type.created",
          objectType: "occurrence-type",
          objectId: item.id,
          outcome: "success",
        });
        return item;
      });
      return reply.status(201).send(created);
    },
  );
  api.put(
    "/api/occurrence-types/:id",
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: occurrenceTypeInputSchema,
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      if (
        !permissionAllowsGlobally(user.permissions, "occurrences.manage_types")
      )
        fail(403, "Você não pode administrar tipos de ocorrência.");
      return db.transaction(async (tx) => {
        await checkDocumentPolicy(tx, request.body);
        const [item] = await tx
          .update(occurrenceTypes)
          .set(request.body)
          .where(eq(occurrenceTypes.id, request.params.id))
          .returning();
        if (!item) fail(404, "Tipo não encontrado.");
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: "occurrence-type.updated",
          objectType: "occurrence-type",
          objectId: item.id,
          outcome: "success",
        });
        return item;
      });
    },
  );
  api.post(
    "/api/occurrences",
    { schema: { body: occurrenceInputSchema } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const input = request.body;
      const item = await db.transaction(async (tx) => {
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
        if (
          !employment ||
          !permissionAllows(
            user.permissions,
            "occurrences.create",
            employment.unitId,
          )
        )
          fail(403, "Você não pode solicitar ocorrências neste vínculo.");
        const [type] = await tx
          .select()
          .from(occurrenceTypes)
          .where(eq(occurrenceTypes.id, input.typeId))
          .for("share");
        if (!type?.active)
          fail(400, "Tipo de ocorrência inativo ou não encontrado.");
        if (input.documentId) {
          const [document] = await tx
            .select()
            .from(functionalDocuments)
            .where(
              and(
                eq(functionalDocuments.id, input.documentId),
                eq(functionalDocuments.personId, user.person.id),
                isNull(functionalDocuments.archivedAt),
              ),
            );
          if (!document || document.typeId !== type.documentTypeId)
            fail(
              400,
              "Comprovante incompatível com o titular ou a política documental.",
            );
        }
        if (input.submit && type.requiresDocument && !input.documentId)
          fail(400, "Anexe o comprovante obrigatório antes de enviar.");
        if (
          input.submit &&
          type.requiresSupervisor &&
          !employment.supervisorRelationshipId
        )
          fail(400, "Cadastre a chefia imediata antes de enviar.");
        const status = !input.submit
          ? "draft"
          : type.requiresSupervisor
            ? "submitted"
            : type.requiresRH
              ? "supervisor_approved"
              : "final_approved";
        if (input.submit)
          await assertAvailablePeriod(
            tx,
            employment.id,
            input.startDate,
            input.endDate,
          );
        const [created] = await tx
          .insert(occurrences)
          .values({
            typeId: type.id,
            typeName: type.name,
            requiresSupervisor: type.requiresSupervisor,
            requiresRH: type.requiresRH,
            requiresDocument: type.requiresDocument,
            affectsAvailability: type.affectsAvailability,
            documentTypeId: type.documentTypeId,
            documentId: input.documentId ?? null,
            requesterAccountId: user.account.id,
            requesterName: user.person.displayName,
            employmentId: employment.id,
            unitId: employment.unitId,
            supervisorRelationshipId:
              input.submit && type.requiresSupervisor
                ? employment.supervisorRelationshipId
                : null,
            startDate: input.startDate,
            endDate: input.endDate,
            justification: input.justification,
            status,
          })
          .returning();
        if (!created) throw new Error("Occurrence not created");
        await tx.insert(occurrenceEvents).values({
          occurrenceId: created.id,
          version: 1,
          actorAccountId: user.account.id,
          type: input.submit ? "submitted" : "created",
        });
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: "occurrence.created",
          objectType: "occurrence",
          objectId: created.id,
          outcome: "success",
          metadata: { status },
        });
        return created;
      });
      return reply.status(201).send(present(item, true));
    },
  );
  api.post(
    "/api/occurrences/:id/transition",
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: occurrenceTransitionSchema,
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      return db.transaction(async (tx) => {
        const [item] = await tx
          .select()
          .from(occurrences)
          .where(eq(occurrences.id, request.params.id))
          .for("update");
        if (!item) fail(404, "Ocorrência não encontrada.");
        const permitted = await access(user, item, tx);
        const { action, version, comment } = request.body;
        const ownerAction = action === "submit" || action === "cancel";
        if (
          ownerAction
            ? !permitted.own ||
              !permissionAllows(
                user.permissions,
                "occurrences.create",
                permitted.unitId,
              )
            : item.status === "submitted"
              ? !permitted.supervisor
              : !permitted.final
        )
          fail(403, "Você não pode realizar esta decisão.");
        if (version !== item.version)
          fail(409, "A ocorrência foi alterada. Atualize antes de decidir.");
        let status: string;
        let event: string;
        let supervisorRelationshipId = item.supervisorRelationshipId;
        if (action === "submit") {
          if (item.status !== "draft")
            fail(409, "Somente rascunhos podem ser enviados.");
          const [employment] = await tx
            .select()
            .from(employmentRelationships)
            .where(eq(employmentRelationships.id, item.employmentId))
            .for("update");
          if (!employment || employment.endDate)
            fail(400, "O vínculo não está ativo.");
          const [type] = await tx
            .select()
            .from(occurrenceTypes)
            .where(eq(occurrenceTypes.id, item.typeId))
            .for("share");
          if (!type?.active) fail(400, "O tipo de ocorrência está inativo.");
          if (item.requiresDocument && !item.documentId)
            fail(400, "Anexe o comprovante obrigatório antes de enviar.");
          if (item.documentId) {
            const [document] = await tx
              .select()
              .from(functionalDocuments)
              .where(
                and(
                  eq(functionalDocuments.id, item.documentId),
                  isNull(functionalDocuments.archivedAt),
                ),
              );
            if (!document)
              fail(
                400,
                "O comprovante foi arquivado. Anexe um documento válido.",
              );
          }
          if (item.requiresSupervisor && !employment.supervisorRelationshipId)
            fail(400, "Cadastre a chefia imediata antes de enviar.");
          supervisorRelationshipId = item.requiresSupervisor
            ? employment.supervisorRelationshipId
            : null;
          status = item.requiresSupervisor
            ? "submitted"
            : item.requiresRH
              ? "supervisor_approved"
              : "final_approved";
          event = "submitted";
        } else if (action === "cancel") {
          if (["cancelled", "rejected"].includes(item.status))
            fail(409, "Esta ocorrência já foi encerrada.");
          status = "cancelled";
          event = "cancelled";
        } else {
          if (!["submitted", "supervisor_approved"].includes(item.status))
            fail(409, "Esta ocorrência não aguarda decisão.");
          const chief = item.status === "submitted";
          status =
            action === "reject"
              ? "rejected"
              : chief && item.requiresRH
                ? "supervisor_approved"
                : "final_approved";
          event = `${chief ? "supervisor" : "final"}-${action === "approve" ? "approved" : "rejected"}`;
        }
        if (action === "submit" || status === "final_approved")
          await assertAvailablePeriod(
            tx,
            item.employmentId,
            item.startDate,
            item.endDate,
            item.id,
          );
        const [updated] = await tx
          .update(occurrences)
          .set({
            status,
            supervisorRelationshipId,
            version: version + 1,
            updatedAt: new Date(),
          })
          .where(eq(occurrences.id, item.id))
          .returning();
        if (!updated) throw new Error("Occurrence not updated");
        await tx.insert(occurrenceEvents).values({
          occurrenceId: item.id,
          version: version + 1,
          actorAccountId: user.account.id,
          type: event,
          comment,
        });
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: `occurrence.${event}`,
          objectType: "occurrence",
          objectId: item.id,
          outcome: "success",
          metadata: {
            version: version + 1,
            status,
            ...(event.startsWith("final-")
              ? delegationMetadata(
                  user.permissions,
                  "occurrences.review.final",
                  permitted.unitId,
                )
              : {}),
            ...(event.startsWith("supervisor-") && permitted.delegation
              ? { delegation: permitted.delegation }
              : {}),
          },
        });
        if (!permitted.own)
          await tx
            .insert(notifications)
            .values({
              accountId: item.requesterAccountId,
              type: "occurrence.updated",
              title: "Sua ocorrência foi atualizada",
              href: `/rh/ocorrencias?occurrenceId=${item.id}`,
              dedupeKey: `occurrence:${item.id}:${version + 1}`,
            })
            .onConflictDoNothing();
        return present(updated, permitted.privateView);
      });
    },
  );
  api.get(
    "/api/occurrences/:id",
    { schema: { params: z.object({ id: z.uuid() }) } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const [item] = await db
        .select()
        .from(occurrences)
        .where(eq(occurrences.id, request.params.id));
      if (!item) fail(404, "Ocorrência não encontrada.");
      const permitted = await access(user, item);
      if (!permitted.own && !permitted.final && !permitted.supervisor)
        fail(404, "Ocorrência não encontrada.");
      const events = await db
        .select({
          ...getTableColumns(occurrenceEvents),
          actorName: people.fullName,
        })
        .from(occurrenceEvents)
        .innerJoin(
          userAccounts,
          eq(occurrenceEvents.actorAccountId, userAccounts.id),
        )
        .innerJoin(people, eq(userAccounts.personId, people.id))
        .where(eq(occurrenceEvents.occurrenceId, item.id))
        .orderBy(asc(occurrenceEvents.version));
      await db.insert(auditEvents).values({
        actorAccountId: user.account.id,
        action: permitted.privateView
          ? "occurrence.private-read"
          : "occurrence.administrative-read",
        objectType: "occurrence",
        objectId: item.id,
        outcome: "success",
      });
      return reply.header("Cache-Control", "no-store").send({
        ...present(item, permitted.privateView),
        actions: [
          ...(permitted.own &&
          permissionAllows(
            user.permissions,
            "occurrences.create",
            permitted.unitId,
          )
            ? [
                ...(item.status === "draft" && !permitted.employment?.endDate
                  ? ["submit"]
                  : []),
                ...(!["cancelled", "rejected"].includes(item.status)
                  ? ["cancel"]
                  : []),
              ]
            : []),
          ...((permitted.supervisor && item.status === "submitted") ||
          (permitted.final && item.status === "supervisor_approved")
            ? ["approve", "reject"]
            : []),
        ],
        events: events.map((event) => ({
          type: event.type,
          actorAccountId: event.actorAccountId,
          actorName: event.actorName,
          version: event.version,
          createdAt: event.createdAt,
          ...(permitted.privateView ? { comment: event.comment } : {}),
        })),
      });
    },
  );
  api.get(
    "/api/occurrences",
    {
      schema: {
        querystring: z.strictObject({
          scope: z.enum(["mine", "supervisor", "final"]).default("mine"),
          page: z.coerce.number().int().min(1).default(1),
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
      const scope = request.query.scope;
      const permission =
        scope === "supervisor"
          ? "occurrences.review.supervisor"
          : "occurrences.review.final";
      if (scope !== "mine" && !permissionAllows(user.permissions, permission))
        fail(403, "Você não pode consultar esta fila.");
      const units = permissionUnitIds(user.permissions, permission);
      const chief =
        scope === "supervisor"
          ? await occurrenceChiefAuthority(db, user)
          : null;
      const rows = await db
        .select({
          occurrence: occurrences,
          unitId: employmentRelationships.unitId,
        })
        .from(occurrences)
        .innerJoin(
          employmentRelationships,
          eq(occurrences.employmentId, employmentRelationships.id),
        )
        .where(
          and(
            scope === "mine"
              ? eq(occurrences.requesterAccountId, user.account.id)
              : scope === "supervisor"
                ? and(chief!.where, eq(occurrences.status, "submitted"))
                : eq(occurrences.status, "supervisor_approved"),
            scope === "mine" || units === null
              ? undefined
              : units.length
                ? inArray(employmentRelationships.unitId, units)
                : sql`false`,
          ),
        )
        .orderBy(desc(occurrences.createdAt), desc(occurrences.id))
        .limit(51)
        .offset((request.query.page - 1) * 50);
      await db.insert(auditEvents).values({
        actorAccountId: user.account.id,
        action: "occurrences.list-read",
        objectType: "occurrence",
        outcome: "success",
        metadata: { scope },
      });
      return reply.header("Cache-Control", "no-store").send({
        occurrences: rows
          .slice(0, 50)
          .map(({ occurrence, unitId }) =>
            present(
              occurrence,
              scope === "mine" ||
                (scope === "final" &&
                  permissionAllows(
                    user.permissions,
                    "documents.sensitive.read",
                    unitId,
                  )),
            ),
          ),
        hasMore: rows.length > 50,
      });
    },
  );
};
