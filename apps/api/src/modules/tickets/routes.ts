import {
  anyPermissionAllows,
  authErrorSchema,
  permissionUnitIds,
  ticketAnalyticsSummarySchema,
  ticketApprovalDecisionInputSchema,
  ticketAssignInputSchema,
  ticketCancelInputSchema,
  ticketCategorySchema,
  ticketCreateInputSchema,
  ticketDetailSchema,
  ticketFeedbackInputSchema,
  ticketFeedbackSchema,
  ticketMessageInputSchema,
  ticketMessageSchema,
  ticketPauseInputSchema,
  ticketRecategorizeInputSchema,
  ticketReopenInputSchema,
  ticketStatusSchema,
  ticketSummarySchema,
  ticketTransitionInputSchema,
} from "@cge/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { Database } from "../../db/client.js";
import {
  requireAnyPermission,
  requireAuthenticatedUser,
} from "../access/authorize.js";
import type { AccessService } from "../access/service.js";
import { recordAudit } from "../audit/service.js";
import type { AuthenticationService } from "../auth/service.js";
import { TicketError, type TicketService } from "./service.js";

const idParamsSchema = z.object({ id: z.uuid() });

export const ticketRoutes: FastifyPluginAsync<{
  accessService: AccessService;
  authenticationService: AuthenticationService;
  db: Database;
  ticketService: TicketService;
}> = async (app, options) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof TicketError) {
      return reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
      });
    }
    return reply.send(error);
  });

  // ── Listar Categorias e Subcategorias ────────────────────────────────────
  typedApp.get(
    "/api/tickets/categories",
    {
      schema: {
        response: {
          200: z.object({ categories: z.array(ticketCategorySchema) }),
          401: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        options.authenticationService,
      );
      if (!user) return;

      const categories = await options.ticketService.listCategories();
      return { categories };
    },
  );

  // ── Listar Meus Chamados (Usuário Comum) ─────────────────────────────────
  typedApp.get(
    "/api/tickets/my",
    {
      schema: {
        response: {
          200: z.object({ tickets: z.array(ticketSummarySchema) }),
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
        "tickets.create",
      );
      if (!user) return;

      const tickets = await options.ticketService.listMyTickets(
        user.account.id,
      );
      return { tickets };
    },
  );

  // ── Abrir Novo Chamado (Usuário Comum) ───────────────────────────────────
  typedApp.post(
    "/api/tickets",
    {
      schema: {
        body: ticketCreateInputSchema,
        response: {
          201: ticketDetailSchema,
          400: authErrorSchema,
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
        "tickets.create",
      );
      if (!user) return;

      const created = await options.ticketService.createTicket(
        user.account.id,
        request.body,
      );

      await recordAudit(options.db, {
        actorAccountId: user.account.id,
        action: "ticket.created",
        objectType: "ticket",
        objectId: created.id,
        outcome: "success",
        metadata: { ticketNumber: created.ticketNumber },
      });

      return reply.status(201).send(created);
    },
  );

  // ── Fila de Atendimento (Técnico / Administrador) ───────────────────────
  typedApp.get(
    "/api/tickets/queue",
    {
      schema: {
        querystring: z.object({
          status: z.array(ticketStatusSchema).optional(),
          area: z.enum(["sistemas", "redes", "manutencao"]).optional(),
        }),
        response: {
          200: z.object({ tickets: z.array(ticketSummarySchema) }),
          401: authErrorSchema,
          403: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        options.authenticationService,
      );
      if (!user) return;

      if (
        !anyPermissionAllows(user.permissions, [
          "tickets.attend",
          "tickets.manage",
        ])
      ) {
        return reply.status(403).send({
          code: "FORBIDDEN",
          message:
            "Você não possui permissão para acessar a fila de atendimento.",
        });
      }

      const grants = user.permissions.filter(
        (g) => g.key === "tickets.attend" || g.key === "tickets.manage",
      );
      const isGlobal = grants.some(
        (g) => g.key === "tickets.manage" || g.unitId === null,
      );
      const unitIds = isGlobal
        ? null
        : permissionUnitIds(grants, "tickets.attend");

      const tickets = await options.ticketService.listQueueTickets(
        unitIds,
        request.query.status,
        request.query.area,
      );
      return { tickets };
    },
  );

  // ── Aprovações Pendentes (Chefe de Setor) ────────────────────────────────
  typedApp.get(
    "/api/tickets/approvals",
    {
      schema: {
        response: {
          200: z.object({ tickets: z.array(ticketSummarySchema) }),
          401: authErrorSchema,
          403: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        options.authenticationService,
      );
      if (!user) return;

      if (
        !anyPermissionAllows(user.permissions, [
          "tickets.approve",
          "tickets.manage",
        ])
      ) {
        return reply.status(403).send({
          code: "FORBIDDEN",
          message: "Você não possui permissão para aprovar chamados.",
        });
      }

      const grants = user.permissions.filter(
        (g) => g.key === "tickets.approve" || g.key === "tickets.manage",
      );
      const isGlobal = grants.some(
        (g) => g.key === "tickets.manage" || g.unitId === null,
      );
      const unitIds = isGlobal
        ? null
        : permissionUnitIds(grants, "tickets.approve");

      const tickets = await options.ticketService.listPendingApprovals(unitIds);
      return { tickets };
    },
  );

  // ── Deliberação de Aprovação ─────────────────────────────────────────────
  typedApp.post(
    "/api/tickets/:id/approve",
    {
      schema: {
        params: idParamsSchema,
        body: ticketApprovalDecisionInputSchema,
        response: {
          200: ticketDetailSchema,
          401: authErrorSchema,
          403: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        options.authenticationService,
      );
      if (!user) return;

      if (
        !anyPermissionAllows(user.permissions, [
          "tickets.approve",
          "tickets.manage",
        ])
      ) {
        return reply.status(403).send({
          code: "FORBIDDEN",
          message: "Você não possui permissão para aprovar chamados.",
        });
      }

      const updated = await options.ticketService.decideApproval(
        request.params.id,
        user.account.id,
        request.body,
      );

      await recordAudit(options.db, {
        actorAccountId: user.account.id,
        action: `ticket.approval-${request.body.decision}`,
        objectType: "ticket",
        objectId: updated.id,
        outcome: "success",
      });

      return updated;
    },
  );

  // ── Detalhes do Chamado ──────────────────────────────────────────────────
  typedApp.get(
    "/api/tickets/:id",
    {
      schema: {
        params: idParamsSchema,
        response: {
          200: ticketDetailSchema,
          401: authErrorSchema,
          403: authErrorSchema,
          404: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        options.authenticationService,
      );
      if (!user) return;

      const isStaffOrAdmin =
        user.permissions.some(
          (p) =>
            p.key === "tickets.attend" ||
            p.key === "tickets.manage" ||
            p.key === "tickets.approve",
        ) || false;

      const ticket = await options.ticketService.getTicket(
        request.params.id,
        user.account.id,
        isStaffOrAdmin,
      );

      return ticket;
    },
  );

  // ── Transicionar Status (Técnico de TI) ──────────────────────────────────
  typedApp.post(
    "/api/tickets/:id/transition",
    {
      schema: {
        params: idParamsSchema,
        body: ticketTransitionInputSchema,
        response: {
          200: ticketDetailSchema,
          400: authErrorSchema,
          401: authErrorSchema,
          403: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        options.authenticationService,
      );
      if (!user) return;

      if (
        !anyPermissionAllows(user.permissions, [
          "tickets.attend",
          "tickets.manage",
        ])
      ) {
        return reply.status(403).send({
          code: "FORBIDDEN",
          message: "Você não possui permissão para atender chamados.",
        });
      }

      const updated = await options.ticketService.transitionTicket(
        request.params.id,
        user.account.id,
        request.body,
      );

      await recordAudit(options.db, {
        actorAccountId: user.account.id,
        action: `ticket.transition-${request.body.toStatus}`,
        objectType: "ticket",
        objectId: updated.id,
        outcome: "success",
      });

      return updated;
    },
  );

  // ── Pausar Chamado ───────────────────────────────────────────────────────
  typedApp.post(
    "/api/tickets/:id/pause",
    {
      schema: {
        params: idParamsSchema,
        body: ticketPauseInputSchema,
        response: {
          200: ticketDetailSchema,
          401: authErrorSchema,
          403: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        options.authenticationService,
      );
      if (!user) return;

      if (
        !anyPermissionAllows(user.permissions, [
          "tickets.attend",
          "tickets.manage",
        ])
      ) {
        return reply.status(403).send({
          code: "FORBIDDEN",
          message: "Você não possui permissão para pausar chamados.",
        });
      }

      const updated = await options.ticketService.pauseTicket(
        request.params.id,
        user.account.id,
        request.body.reason,
      );

      await recordAudit(options.db, {
        actorAccountId: user.account.id,
        action: "ticket.paused",
        objectType: "ticket",
        objectId: updated.id,
        outcome: "success",
      });

      return updated;
    },
  );

  // ── Retomar Chamado ──────────────────────────────────────────────────────
  typedApp.post(
    "/api/tickets/:id/resume",
    {
      schema: {
        params: idParamsSchema,
        response: {
          200: ticketDetailSchema,
          401: authErrorSchema,
          403: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        options.authenticationService,
      );
      if (!user) return;

      if (
        !anyPermissionAllows(user.permissions, [
          "tickets.attend",
          "tickets.manage",
        ])
      ) {
        return reply.status(403).send({
          code: "FORBIDDEN",
          message: "Você não possui permissão para retomar chamados.",
        });
      }

      const updated = await options.ticketService.resumeTicket(
        request.params.id,
        user.account.id,
      );

      await recordAudit(options.db, {
        actorAccountId: user.account.id,
        action: "ticket.resumed",
        objectType: "ticket",
        objectId: updated.id,
        outcome: "success",
      });

      return updated;
    },
  );

  // ── Reatribuir Técnico / Unidade ─────────────────────────────────────────
  typedApp.post(
    "/api/tickets/:id/assign",
    {
      schema: {
        params: idParamsSchema,
        body: ticketAssignInputSchema,
        response: {
          200: ticketDetailSchema,
          401: authErrorSchema,
          403: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        options.authenticationService,
      );
      if (!user) return;

      if (
        !anyPermissionAllows(user.permissions, [
          "tickets.attend",
          "tickets.manage",
        ])
      ) {
        return reply.status(403).send({
          code: "FORBIDDEN",
          message: "Você não possui permissão para transferir chamados.",
        });
      }

      const updated = await options.ticketService.assignTicket(
        request.params.id,
        user.account.id,
        request.body,
      );

      await recordAudit(options.db, {
        actorAccountId: user.account.id,
        action: "ticket.assigned",
        objectType: "ticket",
        objectId: updated.id,
        outcome: "success",
      });

      return updated;
    },
  );

  // ── Recategorizar Chamado ────────────────────────────────────────────────
  typedApp.post(
    "/api/tickets/:id/recategorize",
    {
      schema: {
        params: idParamsSchema,
        body: ticketRecategorizeInputSchema,
        response: {
          200: ticketDetailSchema,
          401: authErrorSchema,
          403: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        options.authenticationService,
      );
      if (!user) return;

      if (
        !anyPermissionAllows(user.permissions, [
          "tickets.attend",
          "tickets.manage",
        ])
      ) {
        return reply.status(403).send({
          code: "FORBIDDEN",
          message: "Você não possui permissão para recategorizar chamados.",
        });
      }

      const updated = await options.ticketService.recategorizeTicket(
        request.params.id,
        user.account.id,
        request.body,
      );

      await recordAudit(options.db, {
        actorAccountId: user.account.id,
        action: "ticket.recategorized",
        objectType: "ticket",
        objectId: updated.id,
        outcome: "success",
      });

      return updated;
    },
  );

  // ── Cancelar Chamado (Solicitante / Técnico) ─────────────────────────────
  typedApp.post(
    "/api/tickets/:id/cancel",
    {
      schema: {
        params: idParamsSchema,
        body: ticketCancelInputSchema,
        response: {
          200: ticketDetailSchema,
          401: authErrorSchema,
          403: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        options.authenticationService,
      );
      if (!user) return;

      if (
        !anyPermissionAllows(user.permissions, [
          "tickets.create",
          "tickets.attend",
          "tickets.manage",
        ])
      ) {
        return reply.status(403).send({
          code: "FORBIDDEN",
          message: "Você não possui permissão para cancelar chamados.",
        });
      }

      const updated = await options.ticketService.cancelTicket(
        request.params.id,
        user.account.id,
        request.body,
      );

      await recordAudit(options.db, {
        actorAccountId: user.account.id,
        action: "ticket.cancelled",
        objectType: "ticket",
        objectId: updated.id,
        outcome: "success",
      });

      return updated;
    },
  );

  // ── Reabrir Chamado (Solicitante / Técnico) ──────────────────────────────
  typedApp.post(
    "/api/tickets/:id/reopen",
    {
      schema: {
        params: idParamsSchema,
        body: ticketReopenInputSchema,
        response: {
          200: ticketDetailSchema,
          401: authErrorSchema,
          403: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        options.authenticationService,
      );
      if (!user) return;

      if (
        !anyPermissionAllows(user.permissions, [
          "tickets.create",
          "tickets.attend",
          "tickets.manage",
        ])
      ) {
        return reply.status(403).send({
          code: "FORBIDDEN",
          message: "Você não possui permissão para reabrir chamados.",
        });
      }

      const updated = await options.ticketService.reopenTicket(
        request.params.id,
        user.account.id,
        request.body,
      );

      await recordAudit(options.db, {
        actorAccountId: user.account.id,
        action: "ticket.reopened",
        objectType: "ticket",
        objectId: updated.id,
        outcome: "success",
      });

      return updated;
    },
  );

  // ── Mensagens / Chat ─────────────────────────────────────────────────────
  typedApp.post(
    "/api/tickets/:id/messages",
    {
      schema: {
        params: idParamsSchema,
        body: ticketMessageInputSchema,
        response: {
          201: ticketMessageSchema,
          401: authErrorSchema,
          403: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        options.authenticationService,
      );
      if (!user) return;

      const isStaff = user.permissions.some(
        (p) => p.key === "tickets.attend" || p.key === "tickets.manage",
      );

      const msg = await options.ticketService.sendMessage(
        request.params.id,
        user.account.id,
        request.body.content,
        !isStaff,
      );

      return reply.status(201).send(msg);
    },
  );

  // ── Avaliação de Satisfação (Solicitante) ─────────────────────────────────
  typedApp.post(
    "/api/tickets/:id/feedback",
    {
      schema: {
        params: idParamsSchema,
        body: ticketFeedbackInputSchema,
        response: {
          201: ticketFeedbackSchema,
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
        "tickets.create",
      );
      if (!user) return;

      const fb = await options.ticketService.submitFeedback(
        request.params.id,
        user.account.id,
        request.body,
      );

      await recordAudit(options.db, {
        actorAccountId: user.account.id,
        action: "ticket.feedback-submitted",
        objectType: "ticket",
        objectId: request.params.id,
        outcome: "success",
        metadata: { rating: fb.rating },
      });

      return reply.status(201).send(fb);
    },
  );

  // ── Analytics / Métricas (Gestores e Administradores) ────────────────────
  typedApp.get(
    "/api/tickets/analytics",
    {
      schema: {
        response: {
          200: ticketAnalyticsSummarySchema,
          401: authErrorSchema,
          403: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        options.authenticationService,
      );
      if (!user) return;

      if (
        !anyPermissionAllows(user.permissions, [
          "tickets.manage",
          "tickets.attend",
        ])
      ) {
        return reply.status(403).send({
          code: "FORBIDDEN",
          message:
            "Você não possui permissão para visualizar métricas de chamados.",
        });
      }

      const grants = user.permissions.filter(
        (g) => g.key === "tickets.manage" || g.key === "tickets.attend",
      );
      const isGlobal = grants.some(
        (g) => g.key === "tickets.manage" || g.unitId === null,
      );
      const unitIds = isGlobal
        ? null
        : permissionUnitIds(grants, "tickets.attend");

      const analytics =
        await options.ticketService.getAnalyticsSummary(unitIds);
      return analytics;
    },
  );
};
