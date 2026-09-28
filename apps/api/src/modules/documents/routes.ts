import {
  documentInputSchema,
  documentSchema,
  documentTypeInputSchema,
  documentTypeSchema,
  permissionAllows,
  permissionAllowsGlobally,
  type AuthenticatedUser,
} from "@cge/contracts";
import { and, desc, eq, isNull, ilike, inArray, or, sql } from "drizzle-orm";
import { permissionUnitIds } from "@cge/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import { requireAuthenticatedUser } from "../access/authorize.js";
import type { AuthenticationService } from "../auth/service.js";
import { recordAudit } from "../audit/service.js";
import { auditEvents } from "../audit/schema.js";
import type { ObjectStorage } from "../storage/object-storage.js";
import { employmentRelationships, people } from "../people/schema.js";
import { documentTypes, functionalDocuments } from "./schema.js";
import { isValidPdf } from "./validate-pdf.js";
import { occurrences, occurrenceEvents } from "../occurrences/schema.js";
import { userAccounts } from "../auth/schema.js";
import { notifications } from "../notifications/schema.js";

const fail = (statusCode: number, message: string) => {
  throw Object.assign(new Error(message), { statusCode });
};
export const documentRoutes: FastifyPluginAsync<{
  db: Database;
  authenticationService: AuthenticationService;
  objectStorage: ObjectStorage;
}> = async (app, { db, authenticationService, objectStorage }) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  api.get(
    "/api/document-people",
    {
      schema: {
        querystring: z.strictObject({
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
      if (
        !permissionAllows(user.permissions, "documents.read") &&
        !permissionAllows(user.permissions, "documents.manage")
      )
        return fail(403, "Você não possui acesso à gestão de documentos.");
      const readUnits = permissionUnitIds(user.permissions, "documents.read");
      const manageUnits = permissionUnitIds(
        user.permissions,
        "documents.manage",
      );
      const units =
        readUnits === null || manageUnits === null
          ? null
          : [...new Set([...readUnits, ...manageUnits])];
      const rows = await db
        .select({ id: people.id, name: people.fullName })
        .from(people)
        .innerJoin(
          employmentRelationships,
          and(
            eq(employmentRelationships.personId, people.id),
            isNull(employmentRelationships.endDate),
          ),
        )
        .where(
          and(
            units === null
              ? undefined
              : units.length
                ? inArray(employmentRelationships.unitId, units)
                : sql`false`,
            request.query.query
              ? or(
                  ilike(people.fullName, `%${request.query.query}%`),
                  ilike(people.preferredName, `%${request.query.query}%`),
                )
              : undefined,
          ),
        )
        .orderBy(people.fullName)
        .limit(30);
      return { people: rows };
    },
  );
  async function allowed(
    user: AuthenticatedUser,
    item: typeof functionalDocuments.$inferSelect,
    manage = false,
  ) {
    if (!manage && user.person.id === item.personId) return true;
    const [employment] = await db
      .select({ unitId: employmentRelationships.unitId })
      .from(employmentRelationships)
      .where(
        and(
          eq(employmentRelationships.personId, item.personId),
          isNull(employmentRelationships.endDate),
        ),
      );
    const unitId = employment?.unitId ?? item.unitId;
    const ordinary = permissionAllows(
      user.permissions,
      manage ? "documents.manage" : "documents.read",
      unitId,
    );
    return (
      ordinary &&
      (!item.sensitive ||
        permissionAllows(
          user.permissions,
          manage ? "documents.sensitive.manage" : "documents.sensitive.read",
          unitId,
        ))
    );
  }
  api.get(
    "/api/document-types",
    {
      schema: {
        response: { 200: z.object({ types: z.array(documentTypeSchema) }) },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      if (!permissionAllows(user.permissions, "documents.manage"))
        return fail(403, "Você não possui permissão para publicar documentos.");
      return {
        types: await db
          .select()
          .from(documentTypes)
          .orderBy(documentTypes.name),
      };
    },
  );
  api.post(
    "/api/document-types",
    { schema: { body: documentTypeInputSchema } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      if (!permissionAllowsGlobally(user.permissions, "documents.manage"))
        return fail(
          403,
          "A política documental exige permissão global de documentos.",
        );
      const item = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(documentTypes)
          .values(request.body)
          .returning();
        if (!created) throw new Error("Document type not created");
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: "document-type.created",
          objectType: "document-type",
          objectId: created.id,
          outcome: "success",
        });
        return created;
      });
      return reply.status(201).send(item);
    },
  );
  api.get(
    "/api/me/documents",
    {
      schema: {
        querystring: z.strictObject({}),
        response: { 200: z.object({ documents: z.array(documentSchema) }) },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const rows = await db
        .select()
        .from(functionalDocuments)
        .where(
          and(
            eq(functionalDocuments.personId, user.person.id),
            isNull(functionalDocuments.archivedAt),
          ),
        )
        .orderBy(desc(functionalDocuments.createdAt));
      await recordAudit(db, {
        actorAccountId: user.account.id,
        action: "documents.list-read",
        objectType: "person",
        objectId: user.person.id,
        outcome: "success",
      });
      return reply
        .header("Cache-Control", "no-store")
        .send({ documents: rows.map((row) => documentSchema.parse(row)) });
    },
  );
  api.get(
    "/api/documents",
    {
      schema: {
        querystring: z.strictObject({ personId: z.uuid() }),
        response: { 200: z.object({ documents: z.array(documentSchema) }) },
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
        !permissionAllows(user.permissions, "documents.read") &&
        !permissionAllows(user.permissions, "documents.manage")
      )
        return fail(
          403,
          "Você não possui permissão para consultar documentos.",
        );
      const rows = await db
        .select()
        .from(functionalDocuments)
        .where(eq(functionalDocuments.personId, request.query.personId))
        .orderBy(desc(functionalDocuments.createdAt));
      const visible = [];
      for (const row of rows)
        if ((await allowed(user, row)) || (await allowed(user, row, true)))
          visible.push(documentSchema.parse(row));
      await recordAudit(db, {
        actorAccountId: user.account.id,
        action: "documents.admin-list-read",
        objectType: "person",
        objectId: request.query.personId,
        outcome: "success",
      });
      return reply
        .header("Cache-Control", "no-store")
        .send({ documents: visible });
    },
  );
  api.post("/api/documents", {}, async (request, reply) => {
    const user = await requireAuthenticatedUser(
      request,
      reply,
      authenticationService,
    );
    if (!user) return;
    if (
      !permissionAllows(user.permissions, "documents.manage") &&
      !permissionAllows(user.permissions, "occurrences.create")
    )
      return fail(403, "Você não possui permissão para publicar documentos.");
    let metadata: unknown;
    let bytes: Buffer | undefined;
    let mime = "";
    try {
      for await (const part of request.parts({
        limits: {
          files: 1,
          fields: 1,
          fileSize: 5 * 1024 * 1024,
          fieldSize: 10_000,
        },
      })) {
        if (part.type === "file") {
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
        return fail(400, "O PDF deve ter no máximo 5 MB.");
      throw error;
    }
    const parsed = documentInputSchema.safeParse(metadata);
    if (!parsed.success)
      return fail(
        400,
        "Confira titular, tipo, título, emissão, fonte e vigência.",
      );
    if (
      !bytes?.length ||
      mime !== "application/pdf" ||
      !/^%PDF-\d\.\d/.test(bytes.subarray(0, 8).toString("ascii")) ||
      !bytes.subarray(-1024).toString("ascii").includes("%%EOF") ||
      !(await isValidPdf(bytes))
    )
      return fail(400, "Selecione um arquivo PDF válido de até 5 MB.");
    const { occurrenceId, occurrenceVersion, ...input } = parsed.data;
    const fileBytes = bytes;
    const objectKey = `documents/${randomUUID()}.pdf`;
    let storing = false;
    try {
      const item = await db.transaction(async (tx) => {
        const [occurrence] = occurrenceId
          ? await tx
              .select()
              .from(occurrences)
              .where(eq(occurrences.id, occurrenceId))
              .for("update")
          : [];
        if (occurrenceId) {
          if (
            !occurrence ||
            occurrence.requesterAccountId !== user.account.id ||
            input.personId !== user.person.id
          )
            return fail(
              403,
              "Você só pode anexar comprovantes às suas ocorrências.",
            );
          if (
            occurrence.status !== "draft" ||
            occurrence.version !== occurrenceVersion
          )
            return fail(
              409,
              "O rascunho foi alterado ou enviado. Atualize a ocorrência.",
            );
          if (
            !occurrence.documentTypeId ||
            occurrence.documentTypeId !== input.typeId
          )
            return fail(
              400,
              "Use a política documental definida para esta ocorrência.",
            );
        }
        const [employment] = await tx
          .select()
          .from(employmentRelationships)
          .where(
            and(
              eq(employmentRelationships.personId, input.personId),
              isNull(employmentRelationships.endDate),
            ),
          )
          .for("update");
        if (
          !employment ||
          !permissionAllows(
            user.permissions,
            occurrence ? "occurrences.create" : "documents.manage",
            employment.unitId,
          )
        )
          return fail(403, "Titular fora do seu escopo de publicação.");
        if (occurrence && employment.id !== occurrence.employmentId)
          return fail(409, "O vínculo da ocorrência não está mais ativo.");
        const [type] = await tx
          .select()
          .from(documentTypes)
          .where(eq(documentTypes.id, input.typeId));
        if (!type)
          return fail(
            400,
            "Cadastre a finalidade e retenção do tipo antes de publicar.",
          );
        if (
          !occurrence &&
          type.sensitive &&
          !permissionAllows(
            user.permissions,
            "documents.sensitive.manage",
            employment.unitId,
          )
        )
          return fail(403, "Documento sensível exige autorização específica.");
        storing = true;
        await objectStorage.put(objectKey, fileBytes, "application/pdf");
        const [created] = await tx
          .insert(functionalDocuments)
          .values({
            ...input,
            validUntil: input.validUntil ?? null,
            unitId: employment.unitId,
            typeName: type.name,
            purpose: type.purpose,
            policyReference: type.policyReference,
            retentionDays: type.retentionDays,
            retainedUntil: new Date(
              Date.now() + type.retentionDays * 86_400_000,
            ),
            sensitive: type.sensitive,
            objectKey,
            size: fileBytes.length,
            authorAccountId: user.account.id,
            authorName: user.person.displayName,
          })
          .returning();
        if (!created) throw new Error("Document not created");
        if (created.requiresAcknowledgment) {
          const [recipient] = await tx
            .select({ id: userAccounts.id })
            .from(userAccounts)
            .where(
              and(
                eq(userAccounts.personId, created.personId),
                eq(userAccounts.status, "active"),
              ),
            );
          if (recipient)
            await tx
              .insert(notifications)
              .values({
                accountId: recipient.id,
                type: "document.acknowledgment-required",
                title: "Documento disponível para ciência",
                message: "Consulte seus documentos na intranet.",
                href: "/rh/meu-dossie",
                dedupeKey: `document:${created.id}:acknowledgment-required`,
              })
              .onConflictDoNothing();
        }
        if (occurrence) {
          await tx
            .update(occurrences)
            .set({
              documentId: created.id,
              version: occurrence.version + 1,
              updatedAt: new Date(),
            })
            .where(eq(occurrences.id, occurrence.id));
          await tx.insert(occurrenceEvents).values({
            occurrenceId: occurrence.id,
            version: occurrence.version + 1,
            actorAccountId: user.account.id,
            type: "document-attached",
          });
          await tx.insert(auditEvents).values({
            actorAccountId: user.account.id,
            action: "occurrence.document-attached",
            objectType: "occurrence",
            objectId: occurrence.id,
            outcome: "success",
            metadata: {
              documentId: created.id,
              version: occurrence.version + 1,
            },
          });
        }
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: "document.uploaded",
          objectType: "document",
          objectId: created.id,
          outcome: "success",
        });
        return created;
      });
      return reply.status(201).send(documentSchema.parse(item));
    } catch (error) {
      if (storing) {
        try {
          await objectStorage.delete(objectKey);
        } catch (cleanupError) {
          request.log.error(
            { err: cleanupError, objectKey },
            "Document upload cleanup failed",
          );
        }
      }
      throw error;
    }
  });
  api.post(
    "/api/documents/:id/acknowledgment",
    { schema: { params: z.object({ id: z.uuid() }) } },
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
          .from(functionalDocuments)
          .where(
            and(
              eq(functionalDocuments.id, request.params.id),
              eq(functionalDocuments.personId, user.person.id),
              isNull(functionalDocuments.archivedAt),
            ),
          )
          .for("update");
        if (!item) return fail(404, "Documento não encontrado.");
        if (!item.requiresAcknowledgment)
          return fail(400, "Este documento não solicita ciência.");
        if (item.acknowledgedAt)
          return { acknowledgedAt: item.acknowledgedAt.toISOString() };
        const acknowledgedAt = new Date();
        await tx
          .update(functionalDocuments)
          .set({ acknowledgedAt, acknowledgedByAccountId: user.account.id })
          .where(eq(functionalDocuments.id, item.id));
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: "document.acknowledged",
          objectType: "document",
          objectId: item.id,
          outcome: "success",
          metadata: { version: 1 },
        });
        return { acknowledgedAt: acknowledgedAt.toISOString() };
      });
    },
  );
  api.get(
    "/api/documents/:id/file",
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
        .from(functionalDocuments)
        .where(
          and(
            eq(functionalDocuments.id, request.params.id),
            isNull(functionalDocuments.archivedAt),
          ),
        );
      if (!item || !(await allowed(user, item)))
        return fail(404, "Documento não encontrado.");
      const object = await objectStorage.get(item.objectKey);
      if (!object)
        return fail(404, "Arquivo indisponível. Procure a Gestão de Pessoas.");
      try {
        await recordAudit(db, {
          actorAccountId: user.account.id,
          action: "document.downloaded",
          objectType: "document",
          objectId: item.id,
          outcome: "success",
        });
      } catch (error) {
        object.body.destroy();
        throw error;
      }
      return reply
        .header("Cache-Control", "no-store")
        .header("Content-Type", "application/pdf")
        .header(
          "Content-Disposition",
          `attachment; filename="documento-${item.id}.pdf"`,
        )
        .header("Content-Length", object.size)
        .send(object.body);
    },
  );
  api.post(
    "/api/documents/:id/archive",
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
        .from(functionalDocuments)
        .where(eq(functionalDocuments.id, request.params.id));
      if (!item || !(await allowed(user, item, true)))
        return fail(404, "Documento não encontrado.");
      await db.transaction(async (tx) => {
        const changed = await tx
          .update(functionalDocuments)
          .set({ archivedAt: new Date() })
          .where(
            and(
              eq(functionalDocuments.id, item.id),
              isNull(functionalDocuments.archivedAt),
            ),
          )
          .returning({ id: functionalDocuments.id });
        if (changed.length)
          await tx.insert(auditEvents).values({
            actorAccountId: user.account.id,
            action: "document.archived",
            objectType: "document",
            objectId: item.id,
            outcome: "success",
          });
      });
      return reply.status(204).send();
    },
  );
};
