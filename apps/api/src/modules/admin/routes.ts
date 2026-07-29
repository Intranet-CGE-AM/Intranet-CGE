import {
  adminUserCreateSchema,
  adminUserSchema,
  authErrorSchema,
  organizationUnitSchema,
  passwordResetSchema,
  personSchema,
} from "@cge/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { AccessService } from "../access/service.js";
import {
  requireAnyGlobalPermission,
  requirePermission,
} from "../access/authorize.js";
import type { AuthenticationService } from "../auth/service.js";
import type { PeopleService } from "../people/service.js";

const idParamsSchema = z.object({ id: z.uuid() });

export const adminRoutes: FastifyPluginAsync<{
  accessService: AccessService;
  authenticationService: AuthenticationService;
  peopleService: PeopleService;
}> = async (app, options) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    "/api/admin/users",
    {
      schema: {
        response: {
          200: z.object({ users: z.array(adminUserSchema) }),
          401: authErrorSchema,
          403: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (
        !(await requireAnyGlobalPermission(
          request,
          reply,
          options.authenticationService,
          ["accounts.manage", "access.manage"],
        ))
      ) {
        return;
      }
      return { users: await options.authenticationService.listAccounts() };
    },
  );

  typedApp.get(
    "/api/admin/people",
    {
      schema: {
        response: {
          200: z.object({ people: z.array(personSchema) }),
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
          "accounts.manage",
        ))
      ) {
        return;
      }
      const result = await options.peopleService.listPeople(null, false);
      return {
        people: result.people,
      };
    },
  );

  typedApp.get(
    "/api/admin/organization-units",
    {
      schema: {
        response: {
          200: z.object({ units: z.array(organizationUnitSchema) }),
          401: authErrorSchema,
          403: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (
        !(await requireAnyGlobalPermission(
          request,
          reply,
          options.authenticationService,
          ["accounts.manage", "access.manage"],
        ))
      ) {
        return;
      }
      return { units: await options.peopleService.listUnits() };
    },
  );

  typedApp.post(
    "/api/admin/users",
    {
      schema: {
        body: adminUserCreateSchema,
        response: {
          201: z.object({ id: z.uuid(), email: z.email() }),
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
        "accounts.manage",
      );
      if (!user) {
        return;
      }
      const { personId, ...account } = request.body;
      return reply
        .status(201)
        .send(
          await options.authenticationService.createAccount(
            personId,
            account,
            user.account.id,
          ),
        );
    },
  );

  typedApp.post(
    "/api/admin/users/:id/password-reset",
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
        "accounts.manage",
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
    "/api/admin/users/:id/deactivate",
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      const user = await requirePermission(
        request,
        reply,
        options.authenticationService,
        options.accessService,
        "accounts.manage",
      );
      if (!user) {
        return;
      }
      if (user.account.id === request.params.id) {
        return reply.status(400).send({
          code: "SELF_DEACTIVATION_NOT_ALLOWED",
          message: "Você não pode desativar a própria conta.",
        });
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
};
