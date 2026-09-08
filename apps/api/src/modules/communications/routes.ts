import {
  communicationInputSchema,
  communicationListSchema,
  communicationSchema,
  permissionAllows,
  type AuthenticatedUser,
  type Communication,
  type PublicationAudience,
} from "@cge/contracts";
import { and, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { micromark } from "micromark";
import { z } from "zod";
import type { Database, Transaction } from "../../db/client.js";
import {
  requireAnyPermission,
  requireAuthenticatedUser,
} from "../access/authorize.js";
import type { AuthenticationService } from "../auth/service.js";
import { auditEvents } from "../audit/schema.js";
import { employmentCategories, organizationUnits } from "../people/schema.js";
import {
  communicationAcknowledgments as acknowledgments,
  hrCommunications as communications,
} from "./schema.js";

const manage = "hr_communications.manage";
const params = z.object({ id: z.uuid() });
const versionInput = z.strictObject({ version: z.number().int().positive() });
const viewQuery = z.object({
  manage: z.enum(["true", "false"]).default("false"),
});
function fail(statusCode: number, message: string): never {
  throw Object.assign(new Error(message), { statusCode });
}
type Record = typeof communications.$inferSelect;
function summary(item: Record, acknowledgedAt: Date | null = null) {
  const now = new Date();
  const status =
    item.status === "draft" || item.status === "archived"
      ? item.status
      : item.expiresAt <= now
        ? "archived"
        : item.publicationAt > now
          ? "scheduled"
          : "published";
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    audience: item.audience,
    requiresAcknowledgment: item.requiresAcknowledgment,
    version: item.version,
    authorAccountId: item.authorAccountId,
    authorName: item.authorName,
    status: status as Communication["status"],
    publicationAt: item.publicationAt.toISOString(),
    expiresAt: item.expiresAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    acknowledgedAt: acknowledgedAt?.toISOString() ?? null,
  };
}
function detail(item: Record, acknowledgedAt: Date | null = null) {
  // HTML e protocolos perigosos ficam desabilitados no parser; nunca interpretar HTML do autor.
  return {
    ...summary(item, acknowledgedAt),
    body: item.body,
    bodyHtml: micromark(item.body),
  };
}
function visible(user: AuthenticatedUser) {
  if (!user.employment) return sql`false`;
  return and(
    inArray(communications.status, ["published", "scheduled"]),
    lte(communications.publicationAt, sql`now()`),
    gt(communications.expiresAt, sql`now()`),
    sql`(${communications.audience}->>'type' = 'all'
      or (${communications.audience}->>'type' = 'units' and ${communications.audience}->'ids' ? ${user.employment.unit.id})
      or (${communications.audience}->>'type' = 'categories' and ${communications.audience}->'ids' ? ${user.employment.category.id}))`,
  );
}

export async function validateAudience(
  tx: Transaction,
  audience: PublicationAudience,
) {
  if (audience.type === "all") return;
  const table =
    audience.type === "units" ? organizationUnits : employmentCategories;
  const selected = await tx
    .select({ id: table.id })
    .from(table)
    .where(and(inArray(table.id, audience.ids), eq(table.active, true)))
    .for("share");
  if (selected.length !== audience.ids.length)
    fail(400, "Escolha somente unidades ou categorias ativas disponíveis.");
}

const audienceKey = (audience: PublicationAudience) =>
  audience.type === "all"
    ? "all"
    : `${audience.type}:${[...audience.ids].sort().join(",")}`;

export const communicationRoutes: FastifyPluginAsync<{
  db: Database;
  authenticationService: AuthenticationService;
}> = async (app, { db, authenticationService }) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  api.get("/api/hr-communications/options", {}, async (request, reply) => {
    if (
      !(await requireAnyPermission(
        request,
        reply,
        authenticationService,
        manage,
      ))
    )
      return;
    const [units, categories] = await Promise.all([
      db
        .select({ id: organizationUnits.id, name: organizationUnits.name })
        .from(organizationUnits)
        .where(eq(organizationUnits.active, true))
        .orderBy(organizationUnits.name),
      db
        .select({
          id: employmentCategories.id,
          name: employmentCategories.name,
        })
        .from(employmentCategories)
        .where(eq(employmentCategories.active, true))
        .orderBy(employmentCategories.name),
    ]);
    return reply
      .header("Cache-Control", "no-store")
      .send({ units, categories });
  });
  function selection(user: AuthenticatedUser) {
    return db
      .select({
        item: communications,
        acknowledgedAt: acknowledgments.acknowledgedAt,
      })
      .from(communications)
      .leftJoin(
        acknowledgments,
        and(
          eq(acknowledgments.communicationId, communications.id),
          eq(acknowledgments.accountId, user.account.id),
          eq(acknowledgments.version, communications.version),
        ),
      );
  }
  api.get(
    "/api/hr-communications",
    {
      schema: {
        querystring: viewQuery.extend({
          page: z.coerce.number().int().positive().default(1),
        }),
        response: { 200: communicationListSchema },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const management = request.query.manage === "true";
      if (
        management
          ? !permissionAllows(user.permissions, manage)
          : !user.employment
      )
        fail(403, "Você não possui acesso a esta consulta de comunicados.");
      const rows = await selection(user)
        .where(management ? undefined : visible(user))
        .orderBy(desc(communications.publicationAt), desc(communications.id))
        .limit(51)
        .offset((request.query.page - 1) * 50);
      return reply.header("Cache-Control", "no-store").send({
        communications: rows
          .slice(0, 50)
          .map((row) => summary(row.item, row.acknowledgedAt)),
        hasMore: rows.length > 50,
      });
    },
  );
  api.get(
    "/api/hr-communications/:id",
    {
      schema: {
        params,
        querystring: viewQuery,
        response: { 200: communicationSchema },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const management = request.query.manage === "true";
      if (
        management
          ? !permissionAllows(user.permissions, manage)
          : !user.employment
      )
        fail(403, "Você não possui acesso a esta consulta de comunicados.");
      const [row] = await selection(user).where(
        and(
          eq(communications.id, request.params.id),
          management ? undefined : visible(user),
        ),
      );
      if (!row)
        fail(404, "Comunicado não encontrado para seu público ou vigência.");
      return reply
        .header("Cache-Control", "no-store")
        .send(detail(row.item, row.acknowledgedAt));
    },
  );
  api.post(
    "/api/hr-communications",
    {
      schema: {
        body: communicationInputSchema,
        response: { 201: communicationSchema },
      },
    },
    async (request, reply) => {
      const user = await requireAnyPermission(
        request,
        reply,
        authenticationService,
        manage,
      );
      if (!user) return;
      const input = request.body;
      const created = await db.transaction(async (tx) => {
        await validateAudience(tx, input.audience);
        const [record] = await tx
          .insert(communications)
          .values({
            ...input,
            publicationAt: new Date(input.publicationAt),
            expiresAt: new Date(input.expiresAt),
            authorAccountId: user.account.id,
            authorName: user.person.displayName,
          })
          .returning();
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: "hr-communication.created",
          objectType: "hr-communication",
          objectId: record!.id,
          outcome: "success",
          metadata: { version: 1, audience: input.audience },
        });
        return record!;
      });
      return reply.code(201).send(detail(created));
    },
  );
  api.put(
    "/api/hr-communications/:id",
    {
      schema: {
        params,
        body: communicationInputSchema.safeExtend({
          version: z.number().int().positive(),
          confirmAudienceChange: z.boolean().default(false),
        }),
        response: { 200: communicationSchema },
      },
    },
    async (request, reply) => {
      const user = await requireAnyPermission(
        request,
        reply,
        authenticationService,
        manage,
      );
      if (!user) return;
      const { version, confirmAudienceChange, ...input } = request.body;
      const result = await db.transaction(async (tx) => {
        const [item] = await tx
          .select()
          .from(communications)
          .where(eq(communications.id, request.params.id))
          .for("update");
        if (!item) fail(404, "Comunicado não encontrado.");
        if (item.version !== version)
          fail(409, "O comunicado foi alterado. Atualize antes de continuar.");
        if (item.status === "archived")
          fail(409, "Um comunicado arquivado não pode ser editado.");
        const audienceChanged =
          audienceKey(item.audience) !== audienceKey(input.audience);
        if (
          item.status !== "draft" &&
          audienceChanged &&
          !confirmAudienceChange
        )
          fail(409, "Confirme a mudança de público do comunicado publicado.");
        await validateAudience(tx, input.audience);
        const [updated] = await tx
          .update(communications)
          .set({
            ...input,
            publicationAt: new Date(input.publicationAt),
            expiresAt: new Date(input.expiresAt),
            version: item.version + 1,
            updatedAt: new Date(),
            status:
              item.status === "draft"
                ? "draft"
                : new Date(input.publicationAt) > new Date()
                  ? "scheduled"
                  : "published",
          })
          .where(eq(communications.id, item.id))
          .returning();
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: "hr-communication.updated",
          objectType: "hr-communication",
          objectId: item.id,
          outcome: "success",
          metadata: {
            version: updated!.version,
            audienceChanged,
            confirmedAudienceChange: audienceChanged && confirmAudienceChange,
            previousAudience: item.audience,
            audience: input.audience,
          },
        });
        return updated!;
      });
      return detail(result);
    },
  );
  api.post(
    "/api/hr-communications/:id/archive",
    {
      schema: {
        params,
        body: versionInput,
        response: { 200: communicationSchema },
      },
    },
    async (request, reply) => {
      const user = await requireAnyPermission(
        request,
        reply,
        authenticationService,
        manage,
      );
      if (!user) return;
      const result = await db.transaction(async (tx) => {
        const [item] = await tx
          .select()
          .from(communications)
          .where(eq(communications.id, request.params.id))
          .for("update");
        if (!item) fail(404, "Comunicado não encontrado.");
        if (item.version !== request.body.version)
          fail(409, "O comunicado foi alterado. Atualize antes de continuar.");
        if (item.status === "archived")
          fail(409, "O comunicado já foi arquivado.");
        const [updated] = await tx
          .update(communications)
          .set({
            status: "archived",
            version: item.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(communications.id, item.id))
          .returning();
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: "hr-communication.archived",
          objectType: "hr-communication",
          objectId: item.id,
          outcome: "success",
          metadata: { version: updated!.version },
        });
        return updated!;
      });
      return detail(result);
    },
  );
  api.post(
    "/api/hr-communications/:id/publish",
    {
      schema: {
        params,
        body: versionInput,
        response: { 200: communicationSchema },
      },
    },
    async (request, reply) => {
      const user = await requireAnyPermission(
        request,
        reply,
        authenticationService,
        manage,
      );
      if (!user) return;
      const record = await db.transaction(async (tx) => {
        const [item] = await tx
          .select()
          .from(communications)
          .where(eq(communications.id, request.params.id))
          .for("update");
        if (!item) fail(404, "Comunicado não encontrado.");
        if (item.version !== request.body.version)
          fail(409, "O comunicado foi alterado. Atualize antes de continuar.");
        if (item.status !== "draft")
          fail(409, "Somente rascunhos podem ser publicados.");
        if (item.expiresAt <= new Date())
          fail(400, "Atualize a vigência antes de publicar.");
        await validateAudience(tx, item.audience);
        const [updated] = await tx
          .update(communications)
          .set({
            status: item.publicationAt > new Date() ? "scheduled" : "published",
            version: item.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(communications.id, item.id))
          .returning();
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: "hr-communication.published",
          objectType: "hr-communication",
          objectId: item.id,
          outcome: "success",
          metadata: {
            version: updated!.version,
            audience: item.audience,
            publicationAt: item.publicationAt.toISOString(),
            expiresAt: item.expiresAt.toISOString(),
          },
        });
        return updated!;
      });
      return detail(record);
    },
  );
  api.post(
    "/api/hr-communications/:id/acknowledgment",
    { schema: { params, body: versionInput } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      if (!user.employment)
        fail(403, "É necessário um vínculo ativo para confirmar ciência.");
      return db.transaction(async (tx) => {
        const [item] = await tx
          .select()
          .from(communications)
          .where(and(eq(communications.id, request.params.id), visible(user)))
          .for("update");
        if (!item)
          fail(404, "Comunicado não encontrado para seu público ou vigência.");
        if (item.version !== request.body.version)
          fail(
            409,
            "O comunicado mudou. Leia a versão atual antes de confirmar.",
          );
        if (!item.requiresAcknowledgment)
          fail(400, "Este comunicado não solicita confirmação de ciência.");
        const [created] = await tx
          .insert(acknowledgments)
          .values({
            communicationId: item.id,
            accountId: user.account.id,
            version: item.version,
          })
          .onConflictDoNothing()
          .returning();
        if (created)
          await tx.insert(auditEvents).values({
            actorAccountId: user.account.id,
            action: "hr-communication.acknowledged",
            objectType: "hr-communication",
            objectId: item.id,
            outcome: "success",
            metadata: { version: item.version },
          });
        const [record] = created
          ? [created]
          : await tx
              .select()
              .from(acknowledgments)
              .where(
                and(
                  eq(acknowledgments.communicationId, item.id),
                  eq(acknowledgments.accountId, user.account.id),
                  eq(acknowledgments.version, item.version),
                ),
              );
        return { acknowledgedAt: record!.acknowledgedAt.toISOString() };
      });
    },
  );
};
