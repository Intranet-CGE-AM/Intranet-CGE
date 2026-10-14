import {
  permissionAllows,
  resourceInputSchema,
  resourceListSchema,
  resourceSchema,
  resourceTypeSchema,
  type AuthenticatedUser,
} from "@cge/contracts";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { Database } from "../../db/client.js";
import {
  requireAnyPermission,
  requireAuthenticatedUser,
} from "../access/authorize.js";
import type { AuthenticationService } from "../auth/service.js";
import { auditEvents } from "../audit/schema.js";
import { recordAudit } from "../audit/service.js";
import type { ObjectStorage } from "../storage/object-storage.js";
import { isValidPdf } from "../documents/validate-pdf.js";
import { validateAudience } from "../communications/routes.js";
import { employmentCategories, organizationUnits } from "../people/schema.js";
import {
  hrResources as resources,
  resourceAcknowledgments as acknowledgments,
} from "./schema.js";
const manage = "hr_resources.manage";
const view = z.object({ manage: z.enum(["true", "false"]).default("false") });
function fail(statusCode: number, message: string): never {
  throw Object.assign(new Error(message), { statusCode });
}
const today = sql`(now() at time zone 'America/Manaus')::date`;
const successor = () => sql<
  string | null
>`(select next_resource.id from hr_resources next_resource
  where coalesce(next_resource.root_id, next_resource.id) = coalesce(${resources.rootId}, ${resources.id})
  and next_resource.version > ${resources.version} and next_resource.valid_from <= ${today}
  order by next_resource.version desc limit 1)`;
function visible(user: AuthenticatedUser) {
  if (!user.employment) return sql`false`;
  return and(
    eq(resources.status, "published"),
    sql`${successor()} is null`,
    lte(resources.validFrom, today),
    gte(resources.validUntil, today),
    sql`(${resources.audience}->>'type' = 'all'
      or (${resources.audience}->>'type' = 'units' and ${resources.audience}->'ids' ? ${user.employment.unit.id})
      or (${resources.audience}->>'type' = 'categories' and ${resources.audience}->'ids' ? ${user.employment.category.id}))`,
  );
}
const serialize = (
  item: typeof resources.$inferSelect,
  supersededById: string | null = null,
  acknowledgedAt: Date | null = null,
) =>
  resourceSchema.parse({
    ...item,
    rootId: item.rootId ?? item.id,
    supersededById,
    acknowledgedAt: acknowledgedAt?.toISOString() ?? null,
    status:
      item.status === "archived"
        ? "archived"
        : supersededById
          ? "superseded"
          : "published",
    createdAt: item.createdAt.toISOString(),
  });
export const resourceRoutes: FastifyPluginAsync<{
  db: Database;
  authenticationService: AuthenticationService;
  objectStorage?: ObjectStorage;
}> = async (app, { db, authenticationService, objectStorage }) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  api.get("/api/hr-resources/options", {}, async (request, reply) => {
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
        item: resources,
        supersededById: successor(),
        acknowledgedAt: acknowledgments.acknowledgedAt,
      })
      .from(resources)
      .leftJoin(
        acknowledgments,
        and(
          eq(acknowledgments.resourceId, resources.id),
          eq(acknowledgments.accountId, user.account.id),
        ),
      );
  }
  api.get(
    "/api/hr-resources",
    {
      schema: {
        querystring: view.extend({
          page: z.coerce.number().int().positive().default(1),
          query: z.string().trim().max(120).default(""),
          type: resourceTypeSchema.optional(),
        }),
        response: { 200: resourceListSchema },
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
        fail(403, "Você não possui acesso a esta consulta da biblioteca.");
      const term = request.query.query ? `%${request.query.query}%` : null;
      const rows = await selection(user)
        .where(
          and(
            management ? undefined : visible(user),
            request.query.type
              ? eq(resources.type, request.query.type)
              : undefined,
            term
              ? or(
                  ilike(resources.title, term),
                  ilike(resources.summary, term),
                  ilike(resources.category, term),
                )
              : undefined,
          ),
        )
        .orderBy(desc(resources.createdAt), desc(resources.id))
        .limit(51)
        .offset((request.query.page - 1) * 50);
      return reply.header("Cache-Control", "no-store").send({
        resources: rows
          .slice(0, 50)
          .map((row) =>
            serialize(row.item, row.supersededById, row.acknowledgedAt),
          ),
        hasMore: rows.length > 50,
      });
    },
  );
  api.get(
    "/api/hr-resources/:id",
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        querystring: view,
        response: { 200: resourceSchema },
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
        fail(403, "Você não possui acesso a esta consulta da biblioteca.");
      const [row] = await selection(user).where(
        and(
          eq(resources.id, request.params.id),
          management ? undefined : visible(user),
        ),
      );
      if (!row)
        fail(404, "Recurso não encontrado para seu público ou vigência.");
      return reply
        .header("Cache-Control", "no-store")
        .send(serialize(row.item, row.supersededById, row.acknowledgedAt));
    },
  );
  async function publishResource(
    request: FastifyRequest,
    reply: FastifyReply,
    sourceId?: string,
  ) {
    const user = await requireAnyPermission(
      request,
      reply,
      authenticationService,
      manage,
    );
    if (!user) return;
    let metadata: unknown = request.body;
    let bytes: Buffer | undefined;
    let mime = "";
    if (request.isMultipart()) {
      try {
        for await (const part of request.parts({
          limits: {
            files: 1,
            fields: 1,
            fileSize: 10 * 1024 * 1024,
            fieldSize: 20000,
          },
        })) {
          if (part.type === "file") {
            if (part.fieldname !== "file")
              fail(400, "Campo de arquivo inválido.");
            bytes = await part.toBuffer();
            mime = part.mimetype;
          } else if (
            part.fieldname === "metadata" &&
            typeof part.value === "string" &&
            !part.valueTruncated
          ) {
            try {
              metadata = JSON.parse(part.value);
            } catch {
              fail(400, "Metadados inválidos.");
            }
          } else fail(400, "Campo de publicação inválido.");
        }
      } catch (cause) {
        if (
          cause instanceof app.multipartErrors.RequestFileTooLargeError ||
          cause instanceof app.multipartErrors.FilesLimitError ||
          cause instanceof app.multipartErrors.FieldsLimitError
        )
          fail(400, "Envie um único PDF de até 10 MB e seus metadados.");
        throw cause;
      }
    }
    const parsed = resourceInputSchema
      .safeExtend({ version: z.number().int().positive().optional() })
      .safeParse(metadata);
    if (!parsed.success)
      fail(
        400,
        "Confira título, categoria, responsável, público, vigência e endereço HTTPS.",
      );
    const { version: expectedVersion, ...input } = parsed.data;
    if (
      sourceId ? expectedVersion === undefined : expectedVersion !== undefined
    )
      fail(400, "Informe a versão atual somente ao publicar uma nova versão.");
    if (input.externalUrl) {
      if (bytes) fail(400, "Escolha somente PDF ou endereço HTTPS, não ambos.");
      const url = new URL(input.externalUrl);
      if (url.username || url.password)
        fail(400, "Não inclua credenciais no endereço.");
    } else {
      if (input.type === "external_link")
        fail(400, "Link externo exige um endereço HTTPS.");
      if (
        !bytes?.length ||
        mime !== "application/pdf" ||
        !/^%PDF-\d\.\d/.test(bytes.subarray(0, 8).toString("ascii")) ||
        !bytes.subarray(-1024).toString("ascii").includes("%%EOF") ||
        !(await isValidPdf(bytes))
      )
        fail(400, "Selecione um arquivo PDF válido de até 10 MB.");
      if (!objectStorage) fail(503, "Armazenamento de arquivos indisponível.");
    }
    const objectKey = bytes ? `resources/${randomUUID()}.pdf` : null;
    let storing = false;
    let item: typeof resources.$inferSelect;
    try {
      item = await db.transaction(async (tx) => {
        let rootId: string | null = null;
        let version = 1;
        if (sourceId) {
          const [source] = await tx
            .select()
            .from(resources)
            .where(eq(resources.id, sourceId));
          if (!source) fail(404, "Recurso não encontrado.");
          rootId = source.rootId ?? source.id;
          await tx
            .select({ id: resources.id })
            .from(resources)
            .where(eq(resources.id, rootId))
            .for("update");
          const [latest] = await tx
            .select()
            .from(resources)
            .where(or(eq(resources.id, rootId), eq(resources.rootId, rootId)))
            .orderBy(desc(resources.version))
            .limit(1);
          if (
            !latest ||
            latest.id !== sourceId ||
            latest.version !== expectedVersion ||
            latest.status === "archived"
          )
            fail(
              409,
              "A publicação mudou ou foi arquivada. Atualize a versão de referência.",
            );
          version = latest.version + 1;
        }
        await validateAudience(tx, input.audience);
        if (objectKey && bytes) {
          storing = true;
          await objectStorage!.put(objectKey, bytes, "application/pdf");
        }
        const [created] = await tx
          .insert(resources)
          .values({
            ...input,
            rootId,
            version,
            objectKey,
            fileSize: bytes?.length ?? null,
            authorAccountId: user.account.id,
            authorName: user.person.displayName,
          })
          .returning();
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: "hr-resource.published",
          objectType: "hr-resource",
          objectId: created!.id,
          outcome: "success",
          metadata: {
            version,
            rootId,
            previousVersionId: sourceId ?? null,
            audience: input.audience,
          },
        });
        return created!;
      });
    } catch (cause) {
      if (storing && objectKey) {
        try {
          await objectStorage!.delete(objectKey);
        } catch (cleanupError) {
          request.log.error(
            { err: cleanupError, objectKey },
            "Resource upload cleanup failed",
          );
        }
      }
      throw cause;
    }
    return reply.code(201).send(serialize(item));
  }
  api.post(
    "/api/hr-resources",
    { schema: { response: { 201: resourceSchema } } },
    publishResource,
  );
  api.post(
    "/api/hr-resources/:id/versions",
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        response: { 201: resourceSchema },
      },
    },
    (request, reply) => publishResource(request, reply, request.params.id),
  );
  api.get(
    "/api/hr-resources/:id/versions",
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        querystring: z.object({
          page: z.coerce.number().int().positive().default(1),
        }),
        response: { 200: resourceListSchema },
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
      const [source] = await db
        .select()
        .from(resources)
        .where(eq(resources.id, request.params.id));
      if (!source) fail(404, "Recurso não encontrado.");
      const rootId = source.rootId ?? source.id;
      const rows = await selection(user)
        .where(or(eq(resources.id, rootId), eq(resources.rootId, rootId)))
        .orderBy(desc(resources.version))
        .limit(51)
        .offset((request.query.page - 1) * 50);
      return reply.header("Cache-Control", "no-store").send({
        resources: rows
          .slice(0, 50)
          .map((row) =>
            serialize(row.item, row.supersededById, row.acknowledgedAt),
          ),
        hasMore: rows.length > 50,
      });
    },
  );
  api.post(
    "/api/hr-resources/:id/acknowledgment",
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: z.strictObject({ version: z.number().int().positive() }),
      },
    },
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
        const [source] = await tx
          .select()
          .from(resources)
          .where(eq(resources.id, request.params.id));
        if (!source) fail(404, "Recurso não encontrado.");
        await tx
          .select({ id: resources.id })
          .from(resources)
          .where(eq(resources.id, source.rootId ?? source.id))
          .for("update");
        const [item] = await tx
          .select()
          .from(resources)
          .where(and(eq(resources.id, source.id), visible(user)));
        if (!item)
          fail(404, "Recurso não encontrado para seu público ou vigência.");
        if (item.version !== request.body.version)
          fail(409, "Leia a versão atual antes de confirmar ciência.");
        if (!item.requiresAcknowledgment)
          fail(400, "Este recurso não solicita confirmação de ciência.");
        const [created] = await tx
          .insert(acknowledgments)
          .values({ resourceId: item.id, accountId: user.account.id })
          .onConflictDoNothing()
          .returning();
        if (created) {
          await tx.insert(auditEvents).values({
            actorAccountId: user.account.id,
            action: "hr-resource.acknowledged",
            objectType: "hr-resource",
            objectId: item.id,
            outcome: "success",
            metadata: { version: item.version },
          });
          return { acknowledgedAt: created.acknowledgedAt.toISOString() };
        }
        const [existing] = await tx
          .select()
          .from(acknowledgments)
          .where(
            and(
              eq(acknowledgments.resourceId, item.id),
              eq(acknowledgments.accountId, user.account.id),
            ),
          );
        return { acknowledgedAt: existing!.acknowledgedAt.toISOString() };
      });
    },
  );
  api.post(
    "/api/hr-resources/:id/archive",
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: z.strictObject({ version: z.number().int().positive() }),
        response: { 200: resourceSchema },
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
        const [source] = await tx
          .select()
          .from(resources)
          .where(eq(resources.id, request.params.id));
        if (!source) fail(404, "Recurso não encontrado.");
        await tx
          .select({ id: resources.id })
          .from(resources)
          .where(eq(resources.id, source.rootId ?? source.id))
          .for("update");
        const [item] = await tx
          .select()
          .from(resources)
          .where(eq(resources.id, source.id))
          .for("update");
        if (
          !item ||
          item.version !== request.body.version ||
          item.status === "archived"
        )
          fail(409, "A publicação mudou ou já foi arquivada.");
        const [updated] = await tx
          .update(resources)
          .set({ status: "archived" })
          .where(eq(resources.id, item.id))
          .returning();
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: "hr-resource.archived",
          objectType: "hr-resource",
          objectId: item.id,
          outcome: "success",
          metadata: { version: item.version },
        });
        return updated!;
      });
      return serialize(result);
    },
  );
  api.get(
    "/api/hr-resources/:id/file",
    { schema: { params: z.object({ id: z.uuid() }), querystring: view } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const management = request.query.manage === "true";
      if (management && !permissionAllows(user.permissions, manage))
        fail(
          403,
          "Você não possui permissão para baixar recursos administrativamente.",
        );
      const [item] = await db
        .select()
        .from(resources)
        .where(
          and(
            eq(resources.id, request.params.id),
            management ? undefined : visible(user),
          ),
        );
      if (!item?.objectKey)
        fail(404, "Arquivo não encontrado para seu público ou vigência.");
      if (!objectStorage) fail(503, "Armazenamento de arquivos indisponível.");
      const object = await objectStorage.get(item.objectKey);
      if (!object)
        fail(404, "Arquivo indisponível. Procure a Gestão de Pessoas.");
      try {
        await recordAudit(db, {
          actorAccountId: user.account.id,
          action: management
            ? "hr-resource.admin-downloaded"
            : "hr-resource.downloaded",
          objectType: "hr-resource",
          objectId: item.id,
          outcome: "success",
          metadata: { version: item.version },
        });
      } catch (cause) {
        object.body.destroy();
        throw cause;
      }
      return reply
        .header("Cache-Control", "no-store")
        .header("Content-Type", "application/pdf")
        .header(
          "Content-Disposition",
          `attachment; filename="recurso-${item.id}-v${item.version}.pdf"`,
        )
        .header("Content-Length", object.size)
        .send(object.body);
    },
  );
};
