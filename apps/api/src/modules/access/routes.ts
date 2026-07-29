import {
  authErrorSchema,
  permissionOverrideInputSchema,
  permissionOverrideSchema,
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
import {
  PermissionOverrideConflictError,
  PermissionScopeError,
  RoleScopeError,
  type AccessService,
} from "./service.js";

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
          400: authErrorSchema,
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
      let role;
      try {
        role = await options.accessService.updateRole(
          request.params.id,
          request.body,
        );
      } catch (error) {
        if (error instanceof RoleScopeError) {
          return reply.status(400).send({
            code: error.code,
            message: error.message,
          });
        }
        throw error;
      }
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
        "access.manage",
      );
      if (!user) {
        return;
      }
      let assignment;
      try {
        assignment = await options.accessService.createAssignment(request.body);
      } catch (error) {
        if (error instanceof RoleScopeError) {
          return reply.status(400).send({
            code: error.code,
            message: error.message,
          });
        }
        throw error;
      }
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

  typedApp.get(
    "/api/admin/permission-overrides",
    {
      schema: {
        querystring: z.object({ accountId: z.uuid().optional() }),
        response: {
          200: z.object({
            overrides: z.array(permissionOverrideSchema),
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
        overrides: await options.accessService.listOverrides(
          request.query.accountId,
        ),
      };
    },
  );

  typedApp.post(
    "/api/admin/permission-overrides",
    {
      schema: {
        body: permissionOverrideInputSchema,
        response: {
          201: permissionOverrideSchema,
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
        "access.manage",
      );
      if (!user) return;
      if (
        request.body.accountId === user.account.id &&
        request.body.permission === "access.manage" &&
        request.body.effect === "deny"
      ) {
        return reply.status(400).send({
          code: "SELF_LOCKOUT_NOT_ALLOWED",
          message: "Você não pode bloquear seu próprio acesso administrativo.",
        });
      }
      let override;
      try {
        override = await options.accessService.createOverride(request.body);
      } catch (error) {
        if (
          error instanceof PermissionScopeError ||
          error instanceof PermissionOverrideConflictError
        ) {
          return reply.status(400).send({
            code: error.code,
            message: error.message,
          });
        }
        throw error;
      }
      await recordAudit(options.db, {
        actorAccountId: user.account.id,
        action: "permission-override.created",
        objectType: "permission-override",
        objectId: override.id,
        outcome: "success",
        metadata: request.body,
      });
      return reply.status(201).send(override);
    },
  );

  typedApp.delete(
    "/api/admin/permission-overrides/:id",
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
      if (!user) return;
      const override = await options.accessService.deleteOverride(
        request.params.id,
      );
      if (!override) {
        return reply.status(404).send({
          code: "OVERRIDE_NOT_FOUND",
          message: "Ajuste individual não encontrado.",
        });
      }
      await recordAudit(options.db, {
        actorAccountId: user.account.id,
        action: "permission-override.deleted",
        objectType: "permission-override",
        objectId: override.id,
        outcome: "success",
      });
      return reply.status(204).send(null);
    },
  );
};
