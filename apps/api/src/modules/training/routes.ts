import {
  trainingInputSchema,
  trainingTransitionSchema,
  trainingSchema,
  trainingDetailSchema,
  trainingSettingsInputSchema,
  trainingSettingsSchema,
  permissionAllows,
  permissionAllowsGlobally,
  type AuthenticatedUser,
} from "@cge/contracts";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { Database, Transaction } from "../../db/client.js";
import { requireAuthenticatedUser } from "../access/authorize.js";
import type { AuthenticationService } from "../auth/service.js";
import {
  employmentRelationships,
  organizationUnits,
} from "../people/schema.js";
import { auditEvents } from "../audit/schema.js";
import { delegationMetadata } from "../substitutions/active.js";
import { notifications } from "../notifications/schema.js";
import { trainingRecords, trainingEvents, trainingSettings } from "./schema.js";
import { documentTypes, functionalDocuments } from "../documents/schema.js";
import { isValidPdf } from "../documents/validate-pdf.js";
import type { ObjectStorage } from "../storage/object-storage.js";

function fail(statusCode: number, message: string): never {
  throw Object.assign(new Error(message), { statusCode });
}
export const trainingRoutes: FastifyPluginAsync<{
  db: Database;
  authenticationService: AuthenticationService;
  objectStorage?: ObjectStorage;
}> = async (app, { db, authenticationService, objectStorage }) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  async function present(
    record: typeof trainingRecords.$inferSelect,
    user: AuthenticatedUser,
  ) {
    if (!record.certificateId)
      return trainingSchema.parse({ ...record, hasCertificate: false });
    // ponytail: páginas de 50 limitam estas leituras; usar join na listagem se a latência justificar.
    const [document] = await db
      .select({
        id: functionalDocuments.id,
        sensitive: functionalDocuments.sensitive,
        archivedAt: functionalDocuments.archivedAt,
        unitId: employmentRelationships.unitId,
      })
      .from(functionalDocuments)
      .innerJoin(
        employmentRelationships,
        eq(employmentRelationships.id, record.employmentId),
      )
      .where(eq(functionalDocuments.id, record.certificateId));
    const readable =
      document &&
      !document.archivedAt &&
      (user.person.id === record.personId ||
        (permissionAllows(
          user.permissions,
          "documents.read",
          document.unitId,
        ) &&
          (!document.sensitive ||
            permissionAllows(
              user.permissions,
              "documents.sensitive.read",
              document.unitId,
            ))));
    return trainingSchema.parse({
      ...record,
      hasCertificate: true,
      certificateId: readable ? record.certificateId : null,
    });
  }
  api.get("/api/training-settings", {}, async (request, reply) => {
    const user = await requireAuthenticatedUser(
      request,
      reply,
      authenticationService,
    );
    if (!user) return;
    const [setting] = await db.select().from(trainingSettings);
    const [certificateType] = setting?.certificateTypeId
      ? await db
          .select()
          .from(documentTypes)
          .where(eq(documentTypes.id, setting.certificateTypeId))
      : [];
    const types = permissionAllowsGlobally(user.permissions, "training.review")
      ? await db.select().from(documentTypes).orderBy(asc(documentTypes.name))
      : [];
    return trainingSettingsSchema.parse({
      certificateType: certificateType ?? null,
      documentTypes: types,
    });
  });
  api.put(
    "/api/training-settings",
    { schema: { body: trainingSettingsInputSchema } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      if (!permissionAllowsGlobally(user.permissions, "training.review"))
        fail(
          403,
          "A política de certificados exige gestão global de capacitações.",
        );
      await db.transaction(async (tx) => {
        if (request.body.certificateTypeId) {
          const [type] = await tx
            .select()
            .from(documentTypes)
            .where(eq(documentTypes.id, request.body.certificateTypeId));
          if (!type) fail(400, "Política documental não encontrada.");
        }
        await tx
          .insert(trainingSettings)
          .values({ id: true, ...request.body })
          .onConflictDoUpdate({
            target: trainingSettings.id,
            set: request.body,
          });
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: "training.settings-updated",
          objectType: "training",
          outcome: "success",
          metadata: request.body,
        });
      });
      return { saved: true };
    },
  );
  async function access(
    user: AuthenticatedUser,
    record: typeof trainingRecords.$inferSelect,
    tx: Database | Transaction = db,
  ) {
    const [employment] = await tx
      .select({ unitId: employmentRelationships.unitId })
      .from(employmentRelationships)
      .where(eq(employmentRelationships.id, record.employmentId));
    const unitId = employment?.unitId ?? record.unitId;
    const own = user.person.id === record.personId;
    const review = permissionAllows(
      user.permissions,
      "training.review",
      unitId,
    );
    return {
      own,
      review,
      unitId,
      read:
        own ||
        review ||
        (record.status === "validated" &&
          permissionAllows(user.permissions, "people.read", unitId)),
    };
  }
  api.post("/api/training", {}, async (request, reply) => {
    const user = await requireAuthenticatedUser(
      request,
      reply,
      authenticationService,
    );
    if (!user) return;
    if (
      !user.employment ||
      !permissionAllows(
        user.permissions,
        "training.create",
        user.employment.unit.id,
      )
    )
      fail(403, "Você não pode registrar capacitações para este vínculo.");
    let metadata: unknown = request.body;
    let bytes: Buffer | undefined;
    let mime = "";
    if (request.isMultipart()) {
      try {
        for await (const part of request.parts({
          limits: {
            files: 1,
            fields: 1,
            fileSize: 5 * 1024 * 1024,
            fieldSize: 10000,
          },
        })) {
          if (part.type === "file" && part.fieldname === "file") {
            mime = part.mimetype;
            bytes = await part.toBuffer();
          } else if (
            part.type === "field" &&
            part.fieldname === "metadata" &&
            typeof part.value === "string"
          ) {
            try {
              metadata = JSON.parse(part.value);
            } catch {
              fail(400, "Dados da capacitação inválidos.");
            }
          } else fail(400, "Campo de envio inválido.");
        }
      } catch (error) {
        if (error instanceof app.multipartErrors.RequestFileTooLargeError)
          fail(400, "O PDF deve ter no máximo 5 MB.");
        throw error;
      }
      if (
        !bytes?.length ||
        mime !== "application/pdf" ||
        !(await isValidPdf(bytes))
      )
        fail(400, "Selecione um PDF válido de até 5 MB.");
    }
    const parsed = trainingInputSchema.safeParse(metadata);
    if (!parsed.success)
      fail(
        400,
        "Confira título, instituição, período e carga horária positiva.",
      );
    const input = parsed.data;
    const objectKey = `documents/${randomUUID()}.pdf`;
    let storing = false;
    try {
      const record = await db.transaction(async (tx) => {
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
            "training.create",
            employment.unitId,
          )
        )
          fail(403, "Você não pode registrar capacitações para este vínculo.");
        let certificateId: string | null = null;
        if (bytes) {
          if (!objectStorage)
            fail(503, "Armazenamento de certificados indisponível.");
          const [setting] = await tx.select().from(trainingSettings);
          const [type] = setting?.certificateTypeId
            ? await tx
                .select()
                .from(documentTypes)
                .where(eq(documentTypes.id, setting.certificateTypeId))
            : [];
          if (!type)
            fail(
              409,
              "O RH precisa definir a política documental antes do envio de certificados.",
            );
          storing = true;
          await objectStorage.put(objectKey, bytes, "application/pdf");
          const [document] = await tx
            .insert(functionalDocuments)
            .values({
              personId: user.person.id,
              unitId: employment.unitId,
              typeId: type.id,
              typeName: type.name,
              title: `Certificado: ${input.title}`,
              issuedOn: input.endDate,
              source: input.institution,
              purpose: type.purpose,
              policyReference: type.policyReference,
              retentionDays: type.retentionDays,
              retainedUntil: new Date(
                Date.now() + type.retentionDays * 86400000,
              ),
              sensitive: type.sensitive,
              objectKey,
              size: bytes.length,
              authorAccountId: user.account.id,
              authorName: user.person.displayName,
            })
            .returning();
          if (!document) throw new Error("Certificado não registrado.");
          certificateId = document.id;
          await tx.insert(auditEvents).values({
            actorAccountId: user.account.id,
            action: "document.uploaded",
            objectType: "document",
            objectId: document.id,
            outcome: "success",
          });
        }
        const [created] = await tx
          .insert(trainingRecords)
          .values({
            ...input,
            certificateId,
            personId: user.person.id,
            requesterAccountId: user.account.id,
            requesterName: user.person.displayName,
            employmentId: employment.id,
            unitId: employment.unitId,
          })
          .returning();
        if (!created) throw new Error("Capacitação não registrada.");
        await tx.insert(trainingEvents).values({
          trainingId: created.id,
          actorAccountId: user.account.id,
          actorName: user.person.displayName,
          type: "submitted",
          version: 1,
        });
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: "training.submitted",
          objectType: "training",
          objectId: created.id,
          outcome: "success",
        });
        return created;
      });
      return reply.code(201).send(
        trainingSchema.parse({
          ...record,
          hasCertificate: Boolean(record.certificateId),
        }),
      );
    } catch (error) {
      if (storing && objectStorage) {
        try {
          await objectStorage.delete(objectKey);
        } catch (cleanupError) {
          request.log.error(
            { err: cleanupError, objectKey },
            "Falha ao limpar certificado após erro",
          );
        }
      }
      throw error;
    }
  });
  api.post(
    "/api/training/:id/transition",
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: trainingTransitionSchema,
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const result = await db.transaction(async (tx) => {
        const [record] = await tx
          .select()
          .from(trainingRecords)
          .where(eq(trainingRecords.id, request.params.id))
          .for("update");
        const permitted = record ? await access(user, record, tx) : null;
        if (!record || !permitted?.review)
          fail(403, "Capacitação fora do seu escopo de análise.");
        if (record.version !== request.body.version)
          fail(409, "A capacitação foi alterada. Atualize antes de decidir.");
        if (
          record.status === "archived" ||
          (request.body.action !== "archive" && record.status !== "submitted")
        )
          fail(409, "Esta capacitação não aceita a decisão selecionada.");
        const status =
          request.body.action === "validate"
            ? "validated"
            : request.body.action === "reject"
              ? "rejected"
              : "archived";
        const version = record.version + 1;
        const [updated] = await tx
          .update(trainingRecords)
          .set({ status, version, updatedAt: new Date() })
          .where(eq(trainingRecords.id, record.id))
          .returning();
        await tx.insert(trainingEvents).values({
          trainingId: record.id,
          actorAccountId: user.account.id,
          actorName: user.person.displayName,
          type: status,
          reason: request.body.reason ?? null,
          version,
        });
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: `training.${status}`,
          objectType: "training",
          objectId: record.id,
          outcome: "success",
          metadata: {
            version,
            ...delegationMetadata(
              user.permissions,
              "training.review",
              permitted.unitId,
            ),
          },
        });
        await tx
          .insert(notifications)
          .values({
            accountId: record.requesterAccountId,
            type: "training.updated",
            title: "Sua capacitação foi atualizada",
            href: `/rh/capacitacoes?trainingId=${record.id}`,
            dedupeKey: `training:${record.id}:${version}`,
          })
          .onConflictDoNothing();
        return updated;
      });
      if (!result) throw new Error("Decisão não registrada.");
      return present(result, user);
    },
  );
  api.get(
    "/api/training/:id",
    { schema: { params: z.object({ id: z.uuid() }) } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const [record] = await db
        .select()
        .from(trainingRecords)
        .where(eq(trainingRecords.id, request.params.id));
      if (!record) fail(404, "Capacitação não encontrada.");
      const allowed = await access(user, record);
      if (!allowed.read) fail(404, "Capacitação não encontrada.");
      const events =
        allowed.own || allowed.review
          ? await db
              .select()
              .from(trainingEvents)
              .where(eq(trainingEvents.trainingId, record.id))
              .orderBy(asc(trainingEvents.version))
          : [];
      reply.header("Cache-Control", "no-store");
      return trainingDetailSchema.parse({
        ...(await present(record, user)),
        events,
        actions:
          !allowed.review || record.status === "archived"
            ? []
            : record.status === "submitted"
              ? ["validate", "reject", "archive"]
              : ["archive"],
      });
    },
  );
  api.get(
    "/api/training",
    {
      schema: {
        querystring: z.strictObject({
          scope: z.enum(["mine", "review", "validated"]).default("mine"),
          personId: z.uuid().optional(),
          page: z.coerce.number().int().positive().default(1),
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
      const { scope, personId, page } = request.query;
      const targetId = personId ?? user.person.id;
      const permission = scope === "review" ? "training.review" : "people.read";
      if (scope === "review" && !permissionAllows(user.permissions, permission))
        fail(403, "Você não pode consultar a fila de capacitações.");
      if (scope !== "validated" && personId)
        fail(
          400,
          "A consulta de outra pessoa é restrita ao histórico validado.",
        );
      const units = (
        await db.select({ id: organizationUnits.id }).from(organizationUnits)
      )
        .filter((unit) =>
          permissionAllows(user.permissions, permission, unit.id),
        )
        .map((unit) => unit.id);
      const restricted =
        scope === "review" ||
        (scope === "validated" && targetId !== user.person.id);
      const records = await db
        .select({ record: trainingRecords })
        .from(trainingRecords)
        .innerJoin(
          employmentRelationships,
          eq(employmentRelationships.id, trainingRecords.employmentId),
        )
        .where(
          and(
            scope === "review"
              ? undefined
              : eq(
                  trainingRecords.personId,
                  scope === "mine" ? user.person.id : targetId,
                ),
            scope === "validated"
              ? eq(trainingRecords.status, "validated")
              : undefined,
            restricted
              ? units.length
                ? inArray(employmentRelationships.unitId, units)
                : sql`false`
              : undefined,
          ),
        )
        .orderBy(desc(trainingRecords.createdAt), desc(trainingRecords.id))
        .limit(51)
        .offset((page - 1) * 50);
      reply.header("Cache-Control", "no-store");
      return {
        records: await Promise.all(
          records.slice(0, 50).map(({ record }) => present(record, user)),
        ),
        hasMore: records.length > 50,
      };
    },
  );
};
