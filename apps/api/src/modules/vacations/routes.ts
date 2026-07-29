import {
  authErrorSchema,
  permissionUnitIds,
  vacationDecisionInputSchema,
  vacationRequestInputSchema,
  vacationRequestSchema,
  vacationVersionInputSchema,
} from "@cge/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { Database } from "../../db/client.js";
import {
  requireAnyPermission,
  requirePermission,
} from "../access/authorize.js";
import type { AccessService } from "../access/service.js";
import { recordAudit } from "../audit/service.js";
import type { AuthenticationService } from "../auth/service.js";
import { VacationError, type VacationService } from "./service.js";

const idParamsSchema = z.object({ id: z.uuid() });

export const vacationRoutes: FastifyPluginAsync<{
  accessService: AccessService;
  authenticationService: AuthenticationService;
  db: Database;
  vacationService: VacationService;
}> = async (app, options) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof VacationError) {
      return reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
      });
    }
    return reply.send(error);
  });

  typedApp.get(
    "/api/vacation-requests",
    {
      schema: {
        querystring: z.object({
          scope: z.enum(["mine", "supervisor", "final"]).default("mine"),
        }),
        response: {
          200: z.object({ requests: z.array(vacationRequestSchema) }),
          401: authErrorSchema,
          403: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const permission =
        request.query.scope === "mine"
          ? "vacations.create"
          : request.query.scope === "supervisor"
            ? "vacations.review.supervisor"
            : "vacations.review.final";
      const user = await requireAnyPermission(
        request,
        reply,
        options.authenticationService,
        permission,
      );
      if (!user) {
        return;
      }
      if (
        request.query.scope === "mine" &&
        (!user.employment ||
          !(await options.accessService.allows(
            user.account.id,
            permission,
            user.employment.unit.id,
          )))
      ) {
        return reply.status(403).send({
          code: "FORBIDDEN",
          message: "Você não possui permissão para este vínculo funcional.",
        });
      }
      const grants = user.permissions.filter(
        (grant) => grant.key === permission,
      );
      const unitIds =
        request.query.scope === "mine"
          ? null
          : permissionUnitIds(grants, permission);
      return {
        requests: await options.vacationService.list(
          user.account.id,
          request.query.scope,
          unitIds,
        ),
      };
    },
  );

  typedApp.post(
    "/api/vacation-requests",
    { schema: { body: vacationRequestInputSchema } },
    async (request, reply) => {
      const tokenUser = await requireAnyPermission(
        request,
        reply,
        options.authenticationService,
        "vacations.create",
      );
      if (!tokenUser?.employment) {
        return tokenUser
          ? reply.status(400).send({
              code: "NO_ACTIVE_EMPLOYMENT",
              message:
                "Sua conta não possui vínculo funcional ativo. Procure a Gestão de Pessoas.",
            })
          : undefined;
      }
      const user = await requirePermission(
        request,
        reply,
        options.authenticationService,
        options.accessService,
        "vacations.create",
        tokenUser.employment.unit.id,
      );
      if (!user) {
        return;
      }
      const created = await options.vacationService.create(
        user.account.id,
        request.body,
      );
      await auditVacation(
        options.db,
        user.account.id,
        created.id,
        request.body.submit ? "vacation.submitted" : "vacation.created",
      );
      return reply.status(201).send(created);
    },
  );

  typedApp.post(
    "/api/vacation-requests/:id/submit",
    {
      schema: {
        body: vacationVersionInputSchema,
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const context = await options.vacationService.context(request.params.id);
      const user = await requirePermission(
        request,
        reply,
        options.authenticationService,
        options.accessService,
        "vacations.create",
        context.unitId,
      );
      if (!user) {
        return;
      }
      const updated = await options.vacationService.submit(
        request.params.id,
        user.account.id,
        request.body.version,
      );
      await auditVacation(
        options.db,
        user.account.id,
        updated.id,
        "vacation.submitted",
      );
      return updated;
    },
  );

  typedApp.post(
    "/api/vacation-requests/:id/supervisor-decision",
    {
      schema: {
        body: vacationDecisionInputSchema,
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const context = await options.vacationService.context(request.params.id);
      const user = await requirePermission(
        request,
        reply,
        options.authenticationService,
        options.accessService,
        "vacations.review.supervisor",
        context.unitId,
      );
      if (!user) {
        return;
      }
      const updated = await options.vacationService.supervisorDecision(
        request.params.id,
        user.account.id,
        request.body,
      );
      await auditVacation(
        options.db,
        user.account.id,
        updated.id,
        `vacation.supervisor-${request.body.decision}`,
      );
      return updated;
    },
  );

  typedApp.post(
    "/api/vacation-requests/:id/hr-decision",
    {
      schema: {
        body: vacationDecisionInputSchema,
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const context = await options.vacationService.context(request.params.id);
      const user = await requirePermission(
        request,
        reply,
        options.authenticationService,
        options.accessService,
        "vacations.review.final",
        context.unitId,
      );
      if (!user) {
        return;
      }
      const updated = await options.vacationService.finalDecision(
        request.params.id,
        user.account.id,
        request.body,
      );
      await auditVacation(
        options.db,
        user.account.id,
        updated.id,
        `vacation.final-${request.body.decision}`,
      );
      return updated;
    },
  );

  typedApp.post(
    "/api/vacation-requests/:id/cancel",
    {
      schema: {
        body: vacationVersionInputSchema,
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const context = await options.vacationService.context(request.params.id);
      const user = await requirePermission(
        request,
        reply,
        options.authenticationService,
        options.accessService,
        "vacations.create",
        context.unitId,
      );
      if (!user) {
        return;
      }
      const updated = await options.vacationService.cancel(
        request.params.id,
        user.account.id,
        request.body.version,
      );
      await auditVacation(
        options.db,
        user.account.id,
        updated.id,
        "vacation.cancelled",
      );
      return updated;
    },
  );
};

function auditVacation(
  db: Database,
  actorAccountId: string,
  objectId: string,
  action: string,
) {
  return recordAudit(db, {
    actorAccountId,
    action,
    objectType: "vacation-request",
    objectId,
    outcome: "success",
  });
}
