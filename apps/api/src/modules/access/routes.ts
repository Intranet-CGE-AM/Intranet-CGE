import {
  authErrorSchema,
  roleAssignmentInputSchema,
  roleAssignmentSchema,
  roleInputSchema,
  roleSchema,
} from "@cge/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { Database } from "../../db/client.js";
import { recordAudit } from "../audit/service.js";
import type { AuthenticationService } from "../auth/service.js";
import { requirePermission } from "./authorize.js";
import type { AccessService } from "./service.js";

const idParamsSchema = z.object({ id: z.uuid() });

export const accessRoutes: FastifyPluginAsync<{
  accessService: AccessService;
  authenticationService: AuthenticationService;
  db: Database;
}> = async (app, options) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    "/api/admin/roles",
    {
      schema: {
        response: {
          200: z.object({ roles: z.array(roleSchema) }),
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
          "access.manage",
        ))
      ) {
        return;
      }
      return { roles: await options.accessService.listRoles() };
    },
  );

  typedApp.post(
    "/api/admin/roles",
    {
      schema: {
        body: roleInputSchema,
        response: {
          201: roleSchema,
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
        "access.manage",
      );
      if (!user) {
        return;
      }
      const role = await options.accessService.createRole(request.body);
      await recordAudit(options.db, {
        actorAccountId: user.account.id,
        action: "role.created",
        objectType: "role",
        objectId: role.id,
        outcome: "success",
      });
      return reply.status(201).send(role);
    },
  );

  typedApp.put(
    "/api/admin/roles/:id",
    {
      schema: {
        body: roleInputSchema,
        params: idParamsSchema,
        response: {
          200: roleSchema,
          401: authErrorSchema,
          403: authErrorSchema,
          404: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requirePermission(
        request,
        reply,
        options.authenticationService,
        options.accessService,
        "access.manage",
      );
      if (!user) {
        return;
      }
      const role = await options.accessService.updateRole(
        request.params.id,
        request.body,
      );
      if (!role) {
        return reply.status(404).send({
          code: "ROLE_NOT_FOUND",
          message: "Perfil não encontrado.",
        });
      }
      await recordAudit(options.db, {
        actorAccountId: user.account.id,
        action: "role.updated",
        objectType: "role",
        objectId: role.id,
        outcome: "success",
      });
      return role;
    },
  );

  typedApp.post(
    "/api/admin/role-assignments",
    {
      schema: {
        body: roleAssignmentInputSchema,
        response: {
          201: roleAssignmentSchema,
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
        "access.manage",
      );
      if (!user) {
        return;
      }
      const assignment = await options.accessService.createAssignment(
        request.body,
      );
      await recordAudit(options.db, {
        actorAccountId: user.account.id,
        action: "role-assignment.created",
        objectType: "role-assignment",
        objectId: assignment.id,
        outcome: "success",
        metadata: {
          accountId: assignment.accountId,
          roleId: assignment.roleId,
          unitId: assignment.unitId,
        },
      });
      return reply.status(201).send(assignment);
    },
  );

  typedApp.get(
    "/api/admin/role-assignments",
    {
      schema: {
        querystring: z.object({ accountId: z.uuid().optional() }),
        response: {
          200: z.object({
            assignments: z.array(roleAssignmentSchema),
          }),
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
          "access.manage",
        ))
      ) {
        return;
      }
      return {
        assignments: await options.accessService.listAssignments(
          request.query.accountId,
        ),
      };
    },
  );

  typedApp.delete(
    "/api/admin/role-assignments/:id",
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
      const user = await requirePermission(
        request,
        reply,
        options.authenticationService,
        options.accessService,
        "access.manage",
      );
      if (!user) {
        return;
      }
      const assignment = await options.accessService.deleteAssignment(
        request.params.id,
      );
      if (!assignment) {
        return reply.status(404).send({
          code: "ASSIGNMENT_NOT_FOUND",
          message: "Atribuição não encontrada.",
        });
      }
      await recordAudit(options.db, {
        actorAccountId: user.account.id,
        action: "role-assignment.deleted",
        objectType: "role-assignment",
        objectId: assignment.id,
        outcome: "success",
      });
      return reply.status(204).send(null);
    },
  );
};
