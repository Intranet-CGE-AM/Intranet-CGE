import {
  auditDocumentActionPermissions,
  auditDocumentActionSchema,
  auditDocumentDetailSchema,
  auditDocumentEventByAction,
  auditDocumentInputSchema,
  auditDocumentListQuerySchema,
  auditDocumentListSchema,
  auditDocumentMaxFileBytes,
  auditDocumentOptionsSchema,
  auditDocumentReviewActions,
  auditDocumentSettingsSchema,
  auditDocumentStatusSchema,
  auditDocumentSummarySchema,
  auditDocumentTransitionSchema,
  auditDocumentVersionInputSchema,
  nextAuditDocumentStatus,
  permissionAllows,
  permissionAllowsGlobally,
  permissionUnitIds,
  type AuditDocumentAction,
  type AuthenticatedUser,
  type PermissionKey,
} from "@cge/contracts";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { createHash, randomUUID } from "node:crypto";
import { basename } from "node:path";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import { requireAuthenticatedUser } from "../access/authorize.js";
import type { AuthenticationService } from "../auth/service.js";
import { auditEvents } from "../audit/schema.js";
import { recordAudit } from "../audit/service.js";
import { organizationUnits } from "../people/schema.js";
import type { ObjectStorage } from "../storage/object-storage.js";
import { delegationMetadata } from "../substitutions/active.js";
import {
  auditDocumentEvents,
  auditDocumentFiles,
  auditDocumentSettings,
  auditDocuments,
} from "./schema.js";
import { validateAuditDocumentFile } from "./validate-file.js";

const fail = (statusCode: number, message: string) => {
  throw Object.assign(new Error(message), { statusCode });
};
const pageSize = 25;
const readKeys = [
  "audit_documents.read",
  "audit_documents.submit",
  "audit_documents.review",
] as const satisfies PermissionKey[];
const mimes = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
} as const;
const kindOf = (mime: string) => (mime === mimes.pdf ? "pdf" : "docx");
// Upload endpoints are the expensive ones (20 MiB bodies, zip inspection).
const uploadLimit = {
  config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
};

type Row = typeof auditDocuments.$inferSelect;

/** null = every unit; [] = none. Union of the keys that grant visibility. */
function visibleUnitIds(user: AuthenticatedUser) {
  const ids = new Set<string>();
  for (const key of readKeys) {
    const units = permissionUnitIds(user.permissions, key);
    if (units === null) return null;
    for (const id of units) ids.add(id);
  }
  return [...ids];
}
const canSee = (user: AuthenticatedUser, unitId: string) =>
  readKeys.some((key) => permissionAllows(user.permissions, key, unitId));
const scopeFilter = (units: string[] | null) =>
  units === null
    ? undefined
    : units.length
      ? inArray(auditDocuments.unitId, units)
      : sql`false`;

function allowedActions(
  user: AuthenticatedUser,
  document: Row,
  latestUploader: string | undefined,
) {
  return auditDocumentActionSchema.options.filter(
    (action) =>
      nextAuditDocumentStatus(document.status, action) !== null &&
      mayPerform(user, document.unitId, action) &&
      !separated(user, action, latestUploader),
  );
}
const mayPerform = (
  user: AuthenticatedUser,
  unitId: string,
  action: AuditDocumentAction,
) =>
  auditDocumentActionPermissions[action].some((key) =>
    permissionAllows(user.permissions, key, unitId),
  );
const separated = (
  user: AuthenticatedUser,
  action: AuditDocumentAction,
  latestUploader: string | undefined,
) =>
  auditDocumentReviewActions.includes(action) &&
  latestUploader === user.account.id;

export const auditDocumentRoutes: FastifyPluginAsync<{
  db: Database;
  authenticationService: AuthenticationService;
  objectStorage: ObjectStorage;
}> = async (app, { db, authenticationService, objectStorage }) => {
  const api = app.withTypeProvider<ZodTypeProvider>();

  async function bottleneckRounds() {
    const [row] = await db.select().from(auditDocumentSettings);
    return row?.bottleneckRounds ?? 3;
  }

  // Files are numbered 1..n without gaps, so the latest number is the count.
  const summaries = () =>
    db
      .select({
        document: auditDocuments,
        unitName: organizationUnits.name,
        latest: {
          id: auditDocumentFiles.id,
          number: auditDocumentFiles.number,
          fileName: auditDocumentFiles.fileName,
          mime: auditDocumentFiles.mime,
        },
      })
      .from(auditDocuments)
      .innerJoin(
        organizationUnits,
        eq(organizationUnits.id, auditDocuments.unitId),
      )
      .innerJoin(
        auditDocumentFiles,
        and(
          eq(auditDocumentFiles.documentId, auditDocuments.id),
          eq(
            auditDocumentFiles.number,
            sql`(select max(f.number) from audit_document_files f where f.document_id = ${auditDocuments.id})`,
          ),
        ),
      )
      .$dynamic();
  const present = (
    row: {
      document: Row;
      unitName: string;
      latest: { id: string; number: number; fileName: string; mime: string };
    },
    rounds: number,
  ) =>
    auditDocumentSummarySchema.parse({
      ...row.document,
      unitName: row.unitName,
      fileCount: row.latest.number,
      latestFileId: row.latest.id,
      latestFileName: row.latest.fileName,
      latestFileKind: kindOf(row.latest.mime),
      bottleneck: row.document.correctionRounds >= rounds,
    });

  async function detail(id: string, user: AuthenticatedUser) {
    const [row] = await summaries().where(eq(auditDocuments.id, id));
    if (!row) return fail(404, "Documento não encontrado.");
    const [files, events, rounds] = await Promise.all([
      db
        .select()
        .from(auditDocumentFiles)
        .where(eq(auditDocumentFiles.documentId, id))
        .orderBy(asc(auditDocumentFiles.number)),
      db
        .select()
        .from(auditDocumentEvents)
        .where(eq(auditDocumentEvents.documentId, id))
        .orderBy(
          asc(auditDocumentEvents.createdAt),
          asc(auditDocumentEvents.id),
        ),
      bottleneckRounds(),
    ]);
    return auditDocumentDetailSchema.parse({
      ...present(row, rounds),
      files: files.map((file) => ({ ...file, kind: kindOf(file.mime) })),
      events,
      allowedActions: allowedActions(
        user,
        row.document,
        files.at(-1)?.uploadedByAccountId,
      ),
    });
  }

  /** Loads a document the user may see; otherwise 404 plus a denied audit row. */
  async function visibleDocument(id: string, user: AuthenticatedUser) {
    const [document] = await db
      .select()
      .from(auditDocuments)
      .where(eq(auditDocuments.id, id));
    if (document && canSee(user, document.unitId)) return document;
    if (document)
      await recordAudit(db, {
        actorAccountId: user.account.id,
        action: "audit-document.access-denied",
        objectType: "audit-document",
        objectId: id,
        outcome: "denied",
      });
    return fail(404, "Documento não encontrado.");
  }

  async function readUpload(request: FastifyRequest) {
    let metadata: unknown;
    let bytes: Buffer | undefined;
    let fileName = "";
    let mime = "";
    try {
      for await (const part of request.parts({
        limits: {
          files: 1,
          fields: 1,
          fileSize: auditDocumentMaxFileBytes,
          fieldSize: 10_000,
        },
      })) {
        if (part.type === "file") {
          fileName = part.filename;
          mime = part.mimetype;
          bytes = await part.toBuffer();
        } else if (
          part.fieldname === "metadata" &&
          typeof part.value === "string"
        ) {
          try {
            metadata = JSON.parse(part.value);
          } catch {
            return fail(400, "Metadados inválidos.");
          }
        } else return fail(400, "Campo de upload inválido.");
      }
    } catch (error) {
      if (error instanceof app.multipartErrors.RequestFileTooLargeError)
        return fail(400, "O arquivo deve ter no máximo 20 MB.");
      throw error;
    }
    if (!bytes?.length) return fail(400, "Selecione um arquivo DOCX ou PDF.");
    // Only for display; the storage key never derives from it.
    const displayName =
      basename(fileName.replaceAll("\\", "/"))
        .replace(/[\p{Cc}"]/gu, "")
        .trim()
        .slice(0, 200) || "documento";
    return { metadata, bytes, displayName, mime };
  }

  async function validFile(bytes: Buffer, fileName: string, mime: string) {
    const result = await validateAuditDocumentFile(bytes, fileName, mime);
    if (!result.ok) return fail(400, result.message);
    return {
      mime: mimes[result.kind],
      sha256: createHash("sha256").update(bytes).digest("hex"),
      objectKey: `audit-documents/${randomUUID()}`,
    };
  }

  /** Runs `work` after storing the object; removes the object if it fails. */
  async function withStoredObject<T>(
    request: FastifyRequest,
    file: { objectKey: string; mime: string },
    bytes: Buffer,
    work: (store: () => Promise<void>) => Promise<T>,
  ) {
    let storing = false;
    try {
      return await work(async () => {
        storing = true;
        await objectStorage.put(file.objectKey, bytes, file.mime);
      });
    } catch (error) {
      if (storing) {
        try {
          await objectStorage.delete(file.objectKey);
        } catch (cleanupError) {
          request.log.error(
            { err: cleanupError, objectKey: file.objectKey },
            "Audit document upload cleanup failed",
          );
        }
      }
      throw error;
    }
  }

  api.get(
    "/api/audit-documents/options",
    { schema: { response: { 200: auditDocumentOptionsSchema } } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      if (!readKeys.some((key) => permissionAllows(user.permissions, key)))
        return fail(403, "Você não possui acesso aos documentos de auditoria.");
      const unitsFor = (ids: string[] | null) =>
        ids !== null && !ids.length
          ? Promise.resolve([])
          : db
              .select({
                id: organizationUnits.id,
                name: organizationUnits.name,
              })
              .from(organizationUnits)
              .where(
                and(
                  eq(organizationUnits.active, true),
                  ids === null ? undefined : inArray(organizationUnits.id, ids),
                ),
              )
              .orderBy(organizationUnits.name);
      const visible = visibleUnitIds(user);
      const [units, visibleUnits, categories] = await Promise.all([
        unitsFor(permissionUnitIds(user.permissions, "audit_documents.submit")),
        unitsFor(visible),
        db
          .selectDistinct({ category: auditDocuments.category })
          .from(auditDocuments)
          .where(and(scopeFilter(visible), isNotNull(auditDocuments.category)))
          .orderBy(auditDocuments.category)
          .limit(100),
      ]);
      return reply.header("Cache-Control", "no-store").send({
        units: permissionAllows(user.permissions, "audit_documents.submit")
          ? units
          : [],
        visibleUnits,
        categories: categories.map((row) => row.category as string),
        maxFileBytes: auditDocumentMaxFileBytes,
      });
    },
  );

  api.get(
    "/api/audit-documents/settings",
    { schema: { response: { 200: auditDocumentSettingsSchema } } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      if (
        ![...readKeys, "audit_documents.reports" as const].some((key) =>
          permissionAllows(user.permissions, key),
        )
      )
        return fail(403, "Você não possui acesso aos documentos de auditoria.");
      return { bottleneckRounds: await bottleneckRounds() };
    },
  );

  api.put(
    "/api/audit-documents/settings",
    {
      schema: {
        body: auditDocumentSettingsSchema,
        response: { 200: auditDocumentSettingsSchema },
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
        !permissionAllowsGlobally(user.permissions, "audit_documents.review") &&
        !permissionAllowsGlobally(user.permissions, "access.manage")
      )
        return fail(
          403,
          "Esta configuração exige análise global ou administração de acessos.",
        );
      await db.transaction(async (tx) => {
        await tx
          .insert(auditDocumentSettings)
          .values({ id: 1, ...request.body })
          .onConflictDoUpdate({
            target: auditDocumentSettings.id,
            set: request.body,
          });
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: "audit-document.settings-updated",
          objectType: "audit-document-settings",
          outcome: "success",
          metadata: request.body,
        });
      });
      return request.body;
    },
  );

  api.get(
    "/api/audit-documents",
    {
      schema: {
        querystring: auditDocumentListQuerySchema,
        response: { 200: auditDocumentListSchema },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      if (!readKeys.some((key) => permissionAllows(user.permissions, key)))
        return fail(403, "Você não possui acesso aos documentos de auditoria.");
      const { status, unitId, category, query, mine, page } = request.query;
      if (unitId && !canSee(user, unitId))
        return fail(403, "Equipe fora do seu escopo.");
      const filters: (SQL | undefined)[] = [
        scopeFilter(visibleUnitIds(user)),
        unitId ? eq(auditDocuments.unitId, unitId) : undefined,
        category ? eq(auditDocuments.category, category) : undefined,
        query
          ? or(
              ilike(auditDocuments.title, `%${query}%`),
              ilike(auditDocuments.reference, `%${query}%`),
            )
          : undefined,
        mine
          ? eq(auditDocuments.createdByAccountId, user.account.id)
          : undefined,
      ];
      const [rows, statusCounts, rounds] = await Promise.all([
        summaries()
          .where(
            and(
              ...filters,
              status ? eq(auditDocuments.status, status) : undefined,
            ),
          )
          .orderBy(
            desc(auditDocuments.statusChangedAt),
            desc(auditDocuments.id),
          )
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({
            status: auditDocuments.status,
            count: sql<number>`count(*)::int`,
          })
          .from(auditDocuments)
          .where(and(...filters))
          .groupBy(auditDocuments.status),
        bottleneckRounds(),
      ]);
      const counts = Object.fromEntries(
        auditDocumentStatusSchema.options.map((item) => [
          item,
          statusCounts.find((row) => row.status === item)?.count ?? 0,
        ]),
      ) as Record<(typeof auditDocumentStatusSchema.options)[number], number>;
      return reply.header("Cache-Control", "no-store").send({
        documents: rows.map((row) => present(row, rounds)),
        total: status
          ? counts[status]
          : Object.values(counts).reduce((sum, value) => sum + value, 0),
        page,
        pageSize,
        counts,
      });
    },
  );

  api.get(
    "/api/audit-documents/:id",
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        response: { 200: auditDocumentDetailSchema },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      await visibleDocument(request.params.id, user);
      return reply
        .header("Cache-Control", "no-store")
        .send(await detail(request.params.id, user));
    },
  );

  api.post("/api/audit-documents", uploadLimit, async (request, reply) => {
    const user = await requireAuthenticatedUser(
      request,
      reply,
      authenticationService,
    );
    if (!user) return;
    if (!permissionAllows(user.permissions, "audit_documents.submit"))
      return fail(403, "Você não possui permissão para enviar documentos.");
    const upload = await readUpload(request);
    const parsed = auditDocumentInputSchema.safeParse(upload.metadata);
    if (!parsed.success)
      return fail(400, "Confira equipe, título, referência e categoria.");
    const { note, ...input } = parsed.data;
    if (
      !permissionAllows(
        user.permissions,
        "audit_documents.submit",
        input.unitId,
      )
    )
      return fail(403, "Equipe fora do seu escopo de envio.");
    const file = await validFile(upload.bytes, upload.displayName, upload.mime);
    const id = await withStoredObject(
      request,
      file,
      upload.bytes,
      async (store) =>
        db.transaction(async (tx) => {
          const [unit] = await tx
            .select({ id: organizationUnits.id })
            .from(organizationUnits)
            .where(
              and(
                eq(organizationUnits.id, input.unitId),
                eq(organizationUnits.active, true),
              ),
            );
          if (!unit) return fail(400, "Selecione uma equipe ativa.");
          const [created] = await tx
            .insert(auditDocuments)
            .values({
              ...input,
              createdByAccountId: user.account.id,
              createdByName: user.person.displayName,
            })
            .returning();
          if (!created) throw new Error("Audit document not created");
          await store();
          const [stored] = await tx
            .insert(auditDocumentFiles)
            .values({
              documentId: created.id,
              number: 1,
              objectKey: file.objectKey,
              fileName: upload.displayName,
              mime: file.mime,
              size: upload.bytes.length,
              sha256: file.sha256,
              note,
              uploadedByAccountId: user.account.id,
              uploadedByName: user.person.displayName,
            })
            .returning({ id: auditDocumentFiles.id });
          await tx.insert(auditDocumentEvents).values({
            documentId: created.id,
            type: "submitted",
            toStatus: "in_review",
            fileId: stored?.id,
            actorAccountId: user.account.id,
            actorName: user.person.displayName,
          });
          await tx.insert(auditEvents).values({
            actorAccountId: user.account.id,
            action: "audit-document.submitted",
            objectType: "audit-document",
            objectId: created.id,
            outcome: "success",
            metadata: { unitId: created.unitId, sha256: file.sha256 },
          });
          return created.id;
        }),
    );
    return reply.status(201).send(await detail(id, user));
  });

  api.post(
    "/api/audit-documents/:id/files",
    { ...uploadLimit, schema: { params: z.object({ id: z.uuid() }) } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const document = await visibleDocument(request.params.id, user);
      if (!mayPerform(user, document.unitId, "submit_version"))
        return fail(403, "Você não possui permissão para enviar versões.");
      const upload = await readUpload(request);
      const parsed = auditDocumentVersionInputSchema.safeParse(upload.metadata);
      if (!parsed.success) return fail(400, "Informe a versão do documento.");
      const file = await validFile(
        upload.bytes,
        upload.displayName,
        upload.mime,
      );
      await withStoredObject(request, file, upload.bytes, async (store) =>
        db.transaction(async (tx) => {
          const [current] = await tx
            .select()
            .from(auditDocuments)
            .where(eq(auditDocuments.id, document.id))
            .for("update");
          if (!current) return fail(404, "Documento não encontrado.");
          if (current.version !== parsed.data.version)
            return fail(
              409,
              "Este documento foi atualizado. Recarregue antes de continuar.",
            );
          const status = nextAuditDocumentStatus(
            current.status,
            "submit_version",
          );
          if (!status)
            return fail(
              409,
              "Nova versão só pode ser enviada após pedido de correção.",
            );
          const [last] = await tx
            .select({ number: auditDocumentFiles.number })
            .from(auditDocumentFiles)
            .where(eq(auditDocumentFiles.documentId, current.id))
            .orderBy(desc(auditDocumentFiles.number))
            .limit(1);
          await store();
          const [stored] = await tx
            .insert(auditDocumentFiles)
            .values({
              documentId: current.id,
              number: (last?.number ?? 0) + 1,
              objectKey: file.objectKey,
              fileName: upload.displayName,
              mime: file.mime,
              size: upload.bytes.length,
              sha256: file.sha256,
              note: parsed.data.note,
              uploadedByAccountId: user.account.id,
              uploadedByName: user.person.displayName,
            })
            .returning({ id: auditDocumentFiles.id });
          const now = new Date();
          await tx
            .update(auditDocuments)
            .set({
              status,
              version: current.version + 1,
              statusChangedAt: now,
              updatedAt: now,
            })
            .where(eq(auditDocuments.id, current.id));
          await tx.insert(auditDocumentEvents).values({
            documentId: current.id,
            type: "resubmitted",
            fromStatus: current.status,
            toStatus: status,
            fileId: stored?.id,
            actorAccountId: user.account.id,
            actorName: user.person.displayName,
          });
          await tx.insert(auditEvents).values({
            actorAccountId: user.account.id,
            action: "audit-document.resubmitted",
            objectType: "audit-document",
            objectId: current.id,
            outcome: "success",
            metadata: { version: current.version + 1, sha256: file.sha256 },
          });
        }),
      );
      return reply.status(201).send(await detail(document.id, user));
    },
  );

  api.post(
    "/api/audit-documents/:id/transition",
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: auditDocumentTransitionSchema,
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const { action, version, message } = request.body;
      const document = await visibleDocument(request.params.id, user);
      await db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(auditDocuments)
          .where(eq(auditDocuments.id, document.id))
          .for("update");
        if (!current) return fail(404, "Documento não encontrado.");
        if (!mayPerform(user, current.unitId, action))
          return fail(403, "Você não possui permissão para esta ação.");
        const [latest] = await tx
          .select({ uploader: auditDocumentFiles.uploadedByAccountId })
          .from(auditDocumentFiles)
          .where(eq(auditDocumentFiles.documentId, current.id))
          .orderBy(desc(auditDocumentFiles.number))
          .limit(1);
        if (separated(user, action, latest?.uploader))
          return fail(
            403,
            "Quem enviou a versão atual não pode analisá-la. Peça a outra pessoa.",
          );
        if (current.version !== version)
          return fail(
            409,
            "Este documento foi atualizado. Recarregue antes de continuar.",
          );
        const status = nextAuditDocumentStatus(current.status, action);
        if (!status)
          return fail(
            409,
            "Esta ação não está disponível na etapa atual. Recarregue o documento.",
          );
        const now = new Date();
        await tx
          .update(auditDocuments)
          .set({
            status,
            version: version + 1,
            statusChangedAt: now,
            updatedAt: now,
            ...(action === "request_correction"
              ? { correctionRounds: current.correctionRounds + 1 }
              : {}),
          })
          .where(eq(auditDocuments.id, current.id));
        const delegation = auditDocumentActionPermissions[action].includes(
          "audit_documents.review",
        )
          ? delegationMetadata(
              user.permissions,
              "audit_documents.review",
              current.unitId,
            )
          : {};
        await tx.insert(auditDocumentEvents).values({
          documentId: current.id,
          type: auditDocumentEventByAction[action],
          fromStatus: current.status,
          toStatus: status,
          message: message ?? null,
          actorAccountId: user.account.id,
          actorName: user.person.displayName,
          delegation: delegation.delegation ?? null,
        });
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: `audit-document.${action}`,
          objectType: "audit-document",
          objectId: current.id,
          outcome: "success",
          metadata: { version: version + 1, ...delegation },
        });
      });
      return detail(document.id, user);
    },
  );

  api.get(
    "/api/audit-documents/:id/files/:fileId",
    { schema: { params: z.object({ id: z.uuid(), fileId: z.uuid() }) } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const document = await visibleDocument(request.params.id, user);
      const [file] = await db
        .select()
        .from(auditDocumentFiles)
        .where(
          and(
            eq(auditDocumentFiles.id, request.params.fileId),
            eq(auditDocumentFiles.documentId, document.id),
          ),
        );
      if (!file) return fail(404, "Arquivo não encontrado.");
      const object = await objectStorage.get(file.objectKey);
      if (!object) return fail(404, "Arquivo indisponível.");
      try {
        await db.transaction(async (tx) => {
          // Automatic read confirmation: once per person and file version.
          await tx
            .insert(auditDocumentEvents)
            .values({
              documentId: document.id,
              type: "read",
              fileId: file.id,
              actorAccountId: user.account.id,
              actorName: user.person.displayName,
            })
            .onConflictDoNothing();
          await tx.insert(auditEvents).values({
            actorAccountId: user.account.id,
            action: "audit-document.file-read",
            objectType: "audit-document",
            objectId: document.id,
            outcome: "success",
            metadata: { fileId: file.id, number: file.number },
          });
        });
      } catch (error) {
        object.body.destroy();
        throw error;
      }
      const extension = kindOf(file.mime);
      return reply
        .header("Cache-Control", "no-store")
        .header("Content-Type", file.mime)
        .header(
          "Content-Disposition",
          `inline; filename="documento-v${file.number}.${extension}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        )
        .header("Content-Length", object.size)
        .send(object.body);
    },
  );
};
