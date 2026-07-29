import {
  authErrorSchema,
  birthdaySchema,
  employmentCategoryInputSchema,
  employmentCategorySchema,
  organizationUnitInputSchema,
  organizationUnitSchema,
  peoplePageSchema,
  peopleImportRequestSchema,
  peopleImportResultSchema,
  personInputSchema,
  personUpdateSchema,
} from "@cge/contracts";
import { permissionAllows, type PermissionKey } from "@cge/contracts";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { Database } from "../../db/client.js";
import {
  requireAuthenticatedUser,
  requireAnyPermission,
  requirePermission,
} from "../access/authorize.js";
import type { AccessService } from "../access/service.js";
import { recordAudit } from "../audit/service.js";
import { readSessionToken } from "../auth/routes.js";
import type { AuthenticationService } from "../auth/service.js";
import type { ObjectStorage } from "../storage/object-storage.js";
import { avatarObjectKey, maxAvatarBytes, normalizeAvatar } from "./avatar.js";
import { runPeopleImport } from "./import-service.js";
import { listBirthdays } from "./birthdays.js";
import type { PeopleService } from "./service.js";

const idParamsSchema = z.object({ id: z.uuid() });
const idResultSchema = z.object({ id: z.uuid() });
const avatarViewPermissions: PermissionKey[] = [
  "people.read",
  "birthdays.read",
  "vacations.review.supervisor",
  "vacations.review.final",
];

export const peopleRoutes: FastifyPluginAsync<{
  accessService: AccessService;
  authenticationService: AuthenticationService;
  db: Database;
  objectStorage: ObjectStorage;
  peopleService: PeopleService;
}> = async (app, options) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  const authorizeAvatarChange = async (
    request: FastifyRequest,
    reply: FastifyReply,
    personId: string,
  ) => {
    const user = await requireAuthenticatedUser(
      request,
      reply,
      options.authenticationService,
    );
    if (!user || user.person.id === personId) return user;

    const unitId = await options.peopleService.getActiveUnitId(personId);
    if (!unitId) {
      await reply.status(404).send({
        code: "PERSON_NOT_FOUND",
        message: "Colaborador ativo não encontrado.",
      });
      return null;
    }
    if (!permissionAllows(user.permissions, "people.manage", unitId)) {
      await reply.status(403).send({
        code: "FORBIDDEN",
        message: "Você não possui permissão para esta ação.",
      });
      return null;
    }
    return user;
  };

  typedApp.get(
    "/api/people/:id/avatar",
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      const token = readSessionToken(request);
      const user = token
        ? await options.authenticationService.authenticate(token)
        : null;
      if (!user) {
        return reply.status(401).send({
          code: "UNAUTHENTICATED",
          message: "Sua sessão não é válida.",
        });
      }
      if (user.person.id !== request.params.id) {
        const unitId = await options.peopleService.getActiveUnitId(
          request.params.id,
        );
        const canView =
          unitId &&
          avatarViewPermissions.some((permission) =>
            permissionAllows(user.permissions, permission, unitId),
          );
        if (!canView) {
          return reply.status(403).send({
            code: "FORBIDDEN",
            message: "Você não possui acesso a esta foto.",
          });
        }
      }
      const avatar = await options.peopleService.getAvatar(request.params.id);
      if (!avatar?.objectKey) {
        return reply.status(404).send({
          code: "AVATAR_NOT_FOUND",
          message: "Foto não cadastrada.",
        });
      }
      const object = await options.objectStorage.get(avatar.objectKey);
      if (!object) {
        return reply.status(404).send({
          code: "AVATAR_NOT_FOUND",
          message: "Foto não encontrada.",
        });
      }
      return reply
        .header("Cache-Control", "private, max-age=86400")
        .header("Content-Length", object.size)
        .header("Content-Type", object.contentType)
        .header("ETag", object.etag)
        .send(object.body);
    },
  );

  typedApp.put(
    "/api/people/:id/avatar",
    {
      schema: {
        params: idParamsSchema,
        response: {
          200: z.object({ avatarUrl: z.string() }),
          400: authErrorSchema,
          401: authErrorSchema,
          403: authErrorSchema,
          404: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await authorizeAvatarChange(
        request,
        reply,
        request.params.id,
      );
      if (!user) return;

      try {
        const file = await request.file({
          limits: { fields: 0, files: 1, fileSize: maxAvatarBytes },
        });
        if (!file) {
          return reply.status(400).send({
            code: "AVATAR_REQUIRED",
            message: "Selecione uma foto.",
          });
        }
        const normalized = await normalizeAvatar(
          await file.toBuffer(),
          file.mimetype,
        );
        const key = avatarObjectKey(request.params.id);
        await options.objectStorage.put(key, normalized, "image/webp");
        const avatarUrl = await options.peopleService.setAvatar(
          request.params.id,
          key,
        );
        if (!avatarUrl) {
          return reply.status(404).send({
            code: "PERSON_NOT_FOUND",
            message: "Colaborador não encontrado.",
          });
        }
        await recordAudit(options.db, {
          actorAccountId: user.account.id,
          action: "person.avatar-updated",
          objectType: "person",
          objectId: request.params.id,
          outcome: "success",
        });
        return { avatarUrl };
      } catch (error) {
        if (
          error instanceof app.multipartErrors.RequestFileTooLargeError ||
          (error instanceof Error && error.message === "AVATAR_SIZE")
        ) {
          return reply.status(400).send({
            code: "AVATAR_TOO_LARGE",
            message: "A foto deve ter no máximo 2 MB.",
          });
        }
        if (
          error instanceof Error &&
          ["AVATAR_TYPE", "AVATAR_INVALID"].includes(error.message)
        ) {
          return reply.status(400).send({
            code: "AVATAR_INVALID",
            message: "Use uma imagem JPEG, PNG ou WebP válida.",
          });
        }
        throw error;
      }
    },
  );

  typedApp.delete(
    "/api/people/:id/avatar",
    {
      schema: {
        params: idParamsSchema,
        response: {
          204: z.null(),
          401: authErrorSchema,
          403: authErrorSchema,
          404: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await authorizeAvatarChange(
        request,
        reply,
        request.params.id,
      );
      if (!user) return;
      const avatar = await options.peopleService.getAvatar(request.params.id);
      if (avatar?.objectKey) {
        await options.objectStorage.delete(avatar.objectKey);
        await options.peopleService.clearAvatar(request.params.id);
        await recordAudit(options.db, {
          actorAccountId: user.account.id,
          action: "person.avatar-deleted",
          objectType: "person",
          objectId: request.params.id,
          outcome: "success",
        });
      }
      return reply.status(204).send(null);
    },
  );

  typedApp.get(
    "/api/people",
    {
      schema: {
        querystring: z.object({
          unitId: z.uuid().optional(),
          page: z.coerce.number().int().positive().default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(10),
          query: z.string().trim().max(120).optional(),
        }),
        response: {
          200: peoplePageSchema,
          401: authErrorSchema,
          403: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requireAnyPermission(
        request,
        reply,
        options.authenticationService,
        "people.read",
      );
      if (!user) {
        return;
      }
      const readGrants = user.permissions.filter(
        (grant) => grant.key === "people.read",
      );
      if (
        request.query.unitId &&
        !permissionAllows(readGrants, "people.read", request.query.unitId)
      ) {
        return reply.status(403).send({
          code: "FORBIDDEN",
          message: "Você não possui permissão para esta unidade.",
        });
      }
      const unitIds = request.query.unitId
        ? [request.query.unitId]
        : readGrants.some((grant) => grant.unitId === null)
          ? null
          : [...new Set(readGrants.flatMap((grant) => grant.unitId ?? []))];
      const includeSensitive = permissionAllows(
        user.permissions,
        "people.manage",
        request.query.unitId,
      );
      const result = await options.peopleService.listPeople(
        unitIds,
        includeSensitive,
        {
          limit: request.query.pageSize,
          offset: (request.query.page - 1) * request.query.pageSize,
          query: request.query.query,
        },
      );
      return {
        people: result.people,
        pagination: {
          page: request.query.page,
          pageSize: request.query.pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / request.query.pageSize),
        },
      };
    },
  );

  typedApp.get(
    "/api/birthdays",
    {
      schema: {
        querystring: z.object({
          days: z.coerce.number().int().min(0).max(90).default(30),
          unitId: z.uuid().optional(),
        }),
        response: {
          200: z.object({ birthdays: z.array(birthdaySchema) }),
          401: authErrorSchema,
          403: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requireAnyPermission(
        request,
        reply,
        options.authenticationService,
        "birthdays.read",
      );
      if (!user) {
        return;
      }
      const grants = user.permissions.filter(
        (grant) => grant.key === "birthdays.read",
      );
      if (
        request.query.unitId &&
        !permissionAllows(grants, "birthdays.read", request.query.unitId)
      ) {
        return reply.status(403).send({
          code: "FORBIDDEN",
          message: "Você não possui permissão para esta unidade.",
        });
      }
      const unitIds = request.query.unitId
        ? [request.query.unitId]
        : grants.some((grant) => grant.unitId === null)
          ? null
          : [...new Set(grants.flatMap((grant) => grant.unitId ?? []))];
      return {
        birthdays: await listBirthdays(options.db, unitIds, request.query.days),
      };
    },
  );

  typedApp.post(
    "/api/people",
    {
      schema: {
        body: personInputSchema,
        response: {
          201: z.object({
            personId: z.uuid(),
            employmentId: z.uuid(),
          }),
          401: authErrorSchema,
          403: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requirePermission(
        request,
        reply,
        options.authenticationService,
        options.accessService,
        "people.manage",
        request.body.employment.unitId,
      );
      if (!user) {
        return;
      }
      const result = await options.peopleService.createPerson(request.body);
      await recordAudit(options.db, {
        actorAccountId: user.account.id,
        action: "person.created",
        objectType: "person",
        objectId: result.personId,
        outcome: "success",
      });
      return reply.status(201).send(result);
    },
  );

  typedApp.patch(
    "/api/people/:id",
    {
      schema: {
        body: personUpdateSchema,
        params: idParamsSchema,
        response: {
          200: idResultSchema,
          401: authErrorSchema,
          403: authErrorSchema,
          404: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const currentUnitId = await options.peopleService.getActiveUnitId(
        request.params.id,
      );
      if (!currentUnitId) {
        return reply.status(404).send({
          code: "PERSON_NOT_FOUND",
          message: "Colaborador não encontrado.",
        });
      }
      const user = await requirePermission(
        request,
        reply,
        options.authenticationService,
        options.accessService,
        "people.manage",
        currentUnitId,
      );
      if (!user) {
        return;
      }
      const destinationUnitId = request.body.employment?.unitId;
      if (
        destinationUnitId &&
        destinationUnitId !== currentUnitId &&
        !(await options.accessService.allows(
          user.account.id,
          "people.manage",
          destinationUnitId,
        ))
      ) {
        return reply.status(403).send({
          code: "FORBIDDEN",
          message:
            "Você não possui permissão para transferir este colaborador para a unidade informada.",
        });
      }
      const person = await options.peopleService.updatePerson(
        request.params.id,
        request.body,
      );
      if (!person) {
        return reply.status(404).send({
          code: "PERSON_NOT_FOUND",
          message: "Colaborador não encontrado.",
        });
      }
      await recordAudit(options.db, {
        actorAccountId: user.account.id,
        action: "person.updated",
        objectType: "person",
        objectId: person.id,
        outcome: "success",
      });
      return person;
    },
  );

  typedApp.post(
    "/api/people/:id/deactivate",
    {
      schema: {
        body: z.object({ endDate: z.iso.date() }),
        params: idParamsSchema,
        response: {
          200: idResultSchema,
          401: authErrorSchema,
          403: authErrorSchema,
          404: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const unitId = await options.peopleService.getActiveUnitId(
        request.params.id,
      );
      if (!unitId) {
        return reply.status(404).send({
          code: "PERSON_NOT_FOUND",
          message: "Colaborador ativo não encontrado.",
        });
      }
      const user = await requirePermission(
        request,
        reply,
        options.authenticationService,
        options.accessService,
        "people.manage",
        unitId,
      );
      if (!user) {
        return;
      }
      const person = await options.peopleService.deactivatePerson(
        request.params.id,
        request.body.endDate,
      );
      if (!person) {
        return reply.status(404).send({
          code: "PERSON_NOT_FOUND",
          message: "Colaborador não encontrado.",
        });
      }
      await options.authenticationService.deactivateAccountForPerson(
        request.params.id,
        user.account.id,
      );
      await recordAudit(options.db, {
        actorAccountId: user.account.id,
        action: "person.deactivated",
        objectType: "person",
        objectId: request.params.id,
        outcome: "success",
      });
      return person;
    },
  );

  typedApp.get("/api/employment-categories", {}, async (request, reply) => {
    if (
      !(await requireAnyPermission(
        request,
        reply,
        options.authenticationService,
        "people.read",
      ))
    ) {
      return;
    }
    return { categories: await options.peopleService.listCategories() };
  });

  typedApp.post(
    "/api/employment-categories",
    {
      schema: {
        body: employmentCategoryInputSchema,
        response: {
          201: employmentCategorySchema,
          401: authErrorSchema,
          403: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (
        !(await requirePermission(
          request,
          reply,
          options.authenticationService,
          options.accessService,
          "people.manage",
        ))
      ) {
        return;
      }
      return reply
        .status(201)
        .send(await options.peopleService.createCategory(request.body));
    },
  );

  typedApp.get("/api/organization-units", {}, async (request, reply) => {
    if (
      !(await requireAnyPermission(
        request,
        reply,
        options.authenticationService,
        "people.read",
      ))
    ) {
      return;
    }
    return { units: await options.peopleService.listUnits() };
  });

  typedApp.post(
    "/api/organization-units",
    {
      schema: {
        body: organizationUnitInputSchema,
        response: {
          201: organizationUnitSchema,
          401: authErrorSchema,
          403: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (
        !(await requirePermission(
          request,
          reply,
          options.authenticationService,
          options.accessService,
          "people.manage",
        ))
      ) {
        return;
      }
      return reply
        .status(201)
        .send(await options.peopleService.createUnit(request.body));
    },
  );

  typedApp.post(
    "/api/imports/people",
    {
      schema: {
        body: peopleImportRequestSchema,
        response: {
          200: peopleImportResultSchema,
          400: authErrorSchema,
          401: authErrorSchema,
          403: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requirePermission(
        request,
        reply,
        options.authenticationService,
        options.accessService,
        "people.import",
      );
      if (!user) {
        return;
      }
      let result;
      try {
        result = await runPeopleImport(
          options.db,
          user.account.id,
          request.body,
        );
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.startsWith("Cabeçalho esperado") ||
            error.message.includes("aspas não fechadas"))
        ) {
          return reply.status(400).send({
            code: "INVALID_CSV",
            message: error.message,
          });
        }
        throw error;
      }
      await recordAudit(options.db, {
        actorAccountId: user.account.id,
        action: `people-import.${request.body.mode}`,
        objectType: "import-run",
        objectId: result.importRunId,
        outcome: "success",
        metadata: {
          checksum: result.checksum,
          failedRows: result.failedRows,
          successfulRows: result.successfulRows,
          totalRows: result.totalRows,
        },
      });
      return result;
    },
  );
};
