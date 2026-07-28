import {
  accountCreateSchema,
  authErrorSchema,
  employmentCategoryInputSchema,
  employmentCategorySchema,
  organizationUnitInputSchema,
  organizationUnitSchema,
  passwordResetSchema,
  peopleImportRequestSchema,
  peopleImportResultSchema,
  personInputSchema,
  personSchema,
  personUpdateSchema,
} from "@cge/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { Database } from "../../db/client.js";
import {
  requireAnyPermission,
  requirePermission,
} from "../access/authorize.js";
import { permissionAllows, type AccessService } from "../access/service.js";
import { recordAudit } from "../audit/service.js";
import type { AuthenticationService } from "../auth/service.js";
import { runPeopleImport } from "./import-service.js";
import type { PeopleService } from "./service.js";

const idParamsSchema = z.object({ id: z.uuid() });
const idResultSchema = z.object({ id: z.uuid() });

export const peopleRoutes: FastifyPluginAsync<{
  accessService: AccessService;
  authenticationService: AuthenticationService;
  db: Database;
  peopleService: PeopleService;
}> = async (app, options) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    "/api/people",
    {
      schema: {
        querystring: z.object({ unitId: z.uuid().optional() }),
        response: {
          200: z.object({ people: z.array(personSchema) }),
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
      return {
        people: await options.peopleService.listPeople(
          unitIds,
          includeSensitive,
        ),
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
      const unitId =
        request.body.employment?.unitId ??
        (await options.peopleService.getActiveUnitId(request.params.id));
      if (!unitId) {
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
        unitId,
      );
      if (!user) {
        return;
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
    "/api/people/:id/account",
    {
      schema: {
        body: accountCreateSchema,
        params: idParamsSchema,
        response: {
          201: z.object({ id: z.uuid(), email: z.email() }),
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
      return reply
        .status(201)
        .send(
          await options.authenticationService.createAccount(
            request.params.id,
            request.body,
            user.account.id,
          ),
        );
    },
  );

  typedApp.post(
    "/api/accounts/:id/password-reset",
    {
      schema: {
        body: passwordResetSchema,
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const user = await requirePermission(
        request,
        reply,
        options.authenticationService,
        options.accessService,
        "people.manage",
      );
      if (!user) {
        return;
      }
      const changed = await options.authenticationService.resetPassword(
        request.params.id,
        request.body,
        user.account.id,
      );
      return changed
        ? { changed: true }
        : reply.status(404).send({
            code: "ACCOUNT_NOT_FOUND",
            message: "Conta não encontrada.",
          });
    },
  );

  typedApp.post(
    "/api/accounts/:id/deactivate",
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      const user = await requirePermission(
        request,
        reply,
        options.authenticationService,
        options.accessService,
        "people.manage",
      );
      if (!user) {
        return;
      }
      const changed = await options.authenticationService.deactivateAccount(
        request.params.id,
        user.account.id,
      );
      return changed
        ? { deactivated: true }
        : reply.status(404).send({
            code: "ACCOUNT_NOT_FOUND",
            message: "Conta não encontrada.",
          });
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
