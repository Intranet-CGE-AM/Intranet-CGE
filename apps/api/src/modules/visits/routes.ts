import {
  visitInputSchema,
  visitListQuerySchema,
  visitUpdateInputSchema,
} from "@cge/contracts";

import type {
  FastifyPluginAsync,
} from "fastify";

import type {
  ZodTypeProvider,
} from "fastify-type-provider-zod";

import {
  z,
} from "zod";

import type {
  Database,
} from "../../db/client.js";

import {
  requireOneOfPermissions,
} from "../access/authorize.js";

import type {
  AccessService,
} from "../access/service.js";

import {
  recordAudit,
} from "../audit/service.js";

import type {
  AuthenticationService,
} from "../auth/service.js";

import type {
  VisitConfirmationService,
} from "./confirmation-services.js";

import {
  VisitError,
  type VisitService,
} from "./service.js";

/* =========================================================
 * PARAMS
 * ======================================================= */

const idParamsSchema =
  z.object({
    id:
      z.uuid(),
  });

/* =========================================================
 * COMMENT
 * ======================================================= */

const commentSchema =
  z.object({
    comment:
      z
        .string()
        .trim()
        .max(2000)
        .nullable()
        .optional(),
  });

/* =========================================================
 * OPTIONS
 * ======================================================= */

type VisitRoutesOptions = {
  accessService:
    AccessService;

  authenticationService:
    AuthenticationService;

  db:
    Database;

  visitService:
    VisitService;

  confirmationService:
    VisitConfirmationService;
};

/* =========================================================
 * ROUTES
 * ======================================================= */

export const visitRoutes:
  FastifyPluginAsync<
    VisitRoutesOptions
  > =
  async (
    app,
    options,
  ) => {
    const typedApp =
      app.withTypeProvider<
        ZodTypeProvider
      >();

    /* =====================================================
     * ERROR HANDLER
     * =================================================== */

    app.setErrorHandler(
      (
        error,
        request,
        reply,
      ) => {
        if (
          error instanceof
          VisitError
        ) {
          return reply
            .status(
              error.statusCode,
            )
            .send({
              code:
                error.code,

              message:
                error.message,
            });
        }

        request.log.error(
          {
            err:
              error,
          },

          "Erro não tratado no módulo de visitas",
        );

        return reply
          .status(500)
          .send({
            code:
              "VISIT_INTERNAL_ERROR",

            message:
              "Não foi possível concluir a operação do agendamento de visitas.",
          });
      },
    );

    /* =====================================================
     * DASHBOARD
     * =================================================== */

    typedApp.get(
      "/api/visits/dashboard",

      async (
        request,
        reply,
      ) => {
        const user =
          await requireOneOfPermissions(
            request,
            reply,
            options.authenticationService,
            [
              "visits.read",
              "visits.manage",
            ],
          );

        if (!user) {
          return;
        }

        return options
          .visitService
          .dashboard();
      },
    );

    /* =====================================================
     * LISTAR
     *
     * Utilizado por:
     *
     * - visão geral;
     * - agenda;
     * - histórico;
     * - relatórios;
     * - exportações.
     * =================================================== */

    typedApp.get(
      "/api/visits",

      {
        schema: {
          querystring:
            visitListQuerySchema,
        },
      },

      async (
        request,
        reply,
      ) => {
        const user =
          await requireOneOfPermissions(
            request,
            reply,
            options.authenticationService,
            [
              "visits.read",
              "visits.history",
              "visits.reports",
              "visits.export",
              "visits.manage",
            ],
          );

        if (!user) {
          return;
        }

        return options
          .visitService
          .list(
            request.query,
          );
      },
    );

    /* =====================================================
     * CONSULTAR DETALHE
     * =================================================== */

    typedApp.get(
      "/api/visits/:id",

      {
        schema: {
          params:
            idParamsSchema,
        },
      },

      async (
        request,
        reply,
      ) => {
        const user =
          await requireOneOfPermissions(
            request,
            reply,
            options.authenticationService,
            [
              "visits.read",
              "visits.history",
              "visits.reports",
              "visits.manage",
            ],
          );

        if (!user) {
          return;
        }

        return options
          .visitService
          .getById(
            request.params.id,
          );
      },
    );

    /* =====================================================
     * CRIAR VISITA
     *
     * Auditoria visit.created é feita pelo VisitService.
     *
     * Depois da criação:
     * tenta enviar a confirmação ao visitante.
     *
     * A falha do SMTP NÃO desfaz o cadastro.
     * =================================================== */

    typedApp.post(
      "/api/visits",

      {
        schema: {
          body:
            visitInputSchema,
        },
      },

      async (
        request,
        reply,
      ) => {
        const user =
          await requireOneOfPermissions(
            request,
            reply,
            options.authenticationService,
            [
              "visits.create",
              "visits.manage",
            ],
          );

        if (!user) {
          return;
        }

        /* =================================================
         * CRIAR AGENDAMENTO
         * =============================================== */

        const created =
          await options
            .visitService
            .create(
              user.account.id,
              request.body,
            );

        /* =================================================
         * CONFIRMAÇÃO AUTOMÁTICA
         * =============================================== */

        let confirmationEmails:
          Awaited<
            ReturnType<
              typeof options.confirmationService.sendForVisit
            >
          > = [];

        try {
          confirmationEmails =
            await options
              .confirmationService
              .sendForVisit(
                created.id,
              );

          const sentCount =
            confirmationEmails.filter(
              (
                result,
              ) =>
                result.sent,
            ).length;

          const failedCount =
            confirmationEmails.length -
            sentCount;

          /* ===============================================
           * AUDITORIA — ENVIO INICIAL
           * ============================================= */

          await recordAudit(
            options.db,
            {
              actorAccountId:
                user.account.id,

              action:
                "visit.confirmation-sent",

              objectType:
                "visit-confirmation",

              objectId:
                created.id,

              outcome:
                sentCount >
                0
                  ? "success"
                  : "failure",

              metadata: {
                visitId:
                  created.id,

                protocol:
                  created.protocol,

                attemptedCount:
                  confirmationEmails.length,

                sentCount,

                failedCount,

                source:
                  "visit-create",
              },
            },
          );

          request.log.info(
            {
              visitId:
                created.id,

              attemptedCount:
                confirmationEmails.length,

              sentCount,

              failedCount,
            },

            "Confirmação de visita processada",
          );
        } catch (
          cause
        ) {
          /* ===============================================
           * AUDITORIA — FALHA GERAL DO ENVIO
           * ============================================= */

          try {
            await recordAudit(
              options.db,
              {
                actorAccountId:
                  user.account.id,

                action:
                  "visit.confirmation-sent",

                objectType:
                  "visit-confirmation",

                objectId:
                  created.id,

                outcome:
                  "failure",

                metadata: {
                  visitId:
                    created.id,

                  protocol:
                    created.protocol,

                  source:
                    "visit-create",

                  reason:
                    safeErrorMessage(
                      cause,
                    ),
                },
              },
            );
          } catch (
            auditError
          ) {
            request.log.error(
              {
                err:
                  auditError,

                visitId:
                  created.id,
              },

              "Falha ao registrar auditoria do envio da confirmação",
            );
          }

          request.log.error(
            {
              err:
                cause,

              visitId:
                created.id,
            },

            "Visita criada, mas ocorreu falha no envio da confirmação por e-mail.",
          );
        }

        return reply
          .status(201)
          .send({
            ...created,

            confirmationEmails,
          });
      },
    );

    /* =====================================================
     * EDITAR
     *
     * Auditoria visit.updated é feita pelo VisitService.
     * =================================================== */

    typedApp.patch(
      "/api/visits/:id",

      {
        schema: {
          params:
            idParamsSchema,

          body:
            visitUpdateInputSchema,
        },
      },

      async (
        request,
        reply,
      ) => {
        const user =
          await requireOneOfPermissions(
            request,
            reply,
            options.authenticationService,
            [
              "visits.update",
              "visits.manage",
            ],
          );

        if (!user) {
          return;
        }

        return options
          .visitService
          .update(
            request.params.id,
            user.account.id,
            request.body,
          );
      },
    );

    /* =====================================================
     * EXCLUIR
     *
     * IMPORTANTE:
     *
     * Agora enviamos user.account.id.
     *
     * Auditoria visit.deleted é feita pelo VisitService.
     * =================================================== */

    typedApp.delete(
      "/api/visits/:id",

      {
        schema: {
          params:
            idParamsSchema,
        },
      },

      async (
        request,
        reply,
      ) => {
        const user =
          await requireOneOfPermissions(
            request,
            reply,
            options.authenticationService,
            [
              "visits.delete",
              "visits.manage",
            ],
          );

        if (!user) {
          return;
        }

        await options
          .visitService
          .remove(
            request.params.id,

            user.account.id,
          );

        return reply
          .status(204)
          .send();
      },
    );

    /* =====================================================
     * APROVAR
     *
     * Auditoria visit.approved é feita pelo VisitService.
     * =================================================== */

    typedApp.post(
      "/api/visits/:id/approve",

      {
        schema: {
          params:
            idParamsSchema,

          body:
            commentSchema,
        },
      },

      async (
        request,
        reply,
      ) => {
        const user =
          await requireOneOfPermissions(
            request,
            reply,
            options.authenticationService,
            [
              "visits.approve",
              "visits.manage",
            ],
          );

        if (!user) {
          return;
        }

        return options
          .visitService
          .approve(
            request.params.id,

            user.account.id,

            request.body.comment,
          );
      },
    );

    /* =====================================================
     * RECUSAR
     *
     * Auditoria visit.rejected é feita pelo VisitService.
     * =================================================== */

    typedApp.post(
      "/api/visits/:id/reject",

      {
        schema: {
          params:
            idParamsSchema,

          body:
            commentSchema,
        },
      },

      async (
        request,
        reply,
      ) => {
        const user =
          await requireOneOfPermissions(
            request,
            reply,
            options.authenticationService,
            [
              "visits.approve",
              "visits.manage",
            ],
          );

        if (!user) {
          return;
        }

        return options
          .visitService
          .reject(
            request.params.id,

            user.account.id,

            request.body.comment,
          );
      },
    );

    /* =====================================================
     * LIBERAR PARA RECEPÇÃO
     *
     * Auditoria visit.released-to-reception
     * é feita pelo VisitService.
     * =================================================== */

    typedApp.post(
      "/api/visits/:id/release-reception",

      {
        schema: {
          params:
            idParamsSchema,
        },
      },

      async (
        request,
        reply,
      ) => {
        const user =
          await requireOneOfPermissions(
            request,
            reply,
            options.authenticationService,
            [
              "visits.release",
              "visits.manage",
            ],
          );

        if (!user) {
          return;
        }

        return options
          .visitService
          .releaseToReception(
            request.params.id,

            user.account.id,
          );
      },
    );

    /* =====================================================
     * REENVIAR CONFIRMAÇÃO
     *
     * Permissão:
     *
     * visits.confirmation.manage
     *
     * Auditoria:
     *
     * visit.confirmation-resent
     * =================================================== */

    typedApp.post(
      "/api/visits/:id/send-confirmation",

      {
        schema: {
          params:
            idParamsSchema,
        },
      },

      async (
        request,
        reply,
      ) => {
        const user =
          await requireOneOfPermissions(
            request,
            reply,
            options.authenticationService,
            [
              "visits.confirmation.manage",
              "visits.manage",
            ],
          );

        if (!user) {
          return;
        }

        /*
         * Recuperamos os dados antes do SMTP para termos
         * protocolo na Auditoria.
         */

        const visit =
          await options
            .visitService
            .getById(
              request.params.id,
            );

        try {
          const results =
            await options
              .confirmationService
              .sendForVisit(
                request.params.id,
              );

          const sentCount =
            results.filter(
              (
                result,
              ) =>
                result.sent,
            ).length;

          const failedCount =
            results.length -
            sentCount;

          await recordAudit(
            options.db,
            {
              actorAccountId:
                user.account.id,

              action:
                "visit.confirmation-resent",

              objectType:
                "visit-confirmation",

              objectId:
                request.params.id,

              outcome:
                sentCount >
                0
                  ? "success"
                  : "failure",

              metadata: {
                visitId:
                  request.params.id,

                protocol:
                  visit.protocol,

                attemptedCount:
                  results.length,

                sentCount,

                failedCount,

                source:
                  "manual-resend",
              },
            },
          );

          request.log.info(
            {
              visitId:
                request.params.id,

              attemptedCount:
                results.length,

              sentCount,

              failedCount,
            },

            "Reenvio de confirmação de visita processado",
          );

          return reply.send({
            success:
              sentCount >
              0,

            results,
          });
        } catch (
          cause
        ) {
          /* ===============================================
           * AUDITORIA DA FALHA
           * ============================================= */

          try {
            await recordAudit(
              options.db,
              {
                actorAccountId:
                  user.account.id,

                action:
                  "visit.confirmation-resent",

                objectType:
                  "visit-confirmation",

                objectId:
                  request.params.id,

                outcome:
                  "failure",

                metadata: {
                  visitId:
                    request.params.id,

                  protocol:
                    visit.protocol,

                  source:
                    "manual-resend",

                  reason:
                    safeErrorMessage(
                      cause,
                    ),
                },
              },
            );
          } catch (
            auditError
          ) {
            request.log.error(
              {
                err:
                  auditError,

                visitId:
                  request.params.id,
              },

              "Falha ao registrar auditoria do reenvio da confirmação",
            );
          }

          request.log.error(
            {
              err:
                cause,

              visitId:
                request.params.id,
            },

            "Falha ao reenviar confirmação de visita",
          );

          return reply
            .status(502)
            .send({
              code:
                "VISIT_CONFIRMATION_SEND_FAILED",

              message:
                "Não foi possível enviar a confirmação ao visitante.",
            });
        }
      },
    );

    /* =====================================================
     * INICIAR ATENDIMENTO
     *
     * Auditoria visit.started é feita pelo VisitService.
     * =================================================== */

    typedApp.post(
      "/api/visits/:id/start",

      {
        schema: {
          params:
            idParamsSchema,
        },
      },

      async (
        request,
        reply,
      ) => {
        const user =
          await requireOneOfPermissions(
            request,
            reply,
            options.authenticationService,
            [
              "visits.manage",
            ],
          );

        if (!user) {
          return;
        }

        return options
          .visitService
          .startService(
            request.params.id,

            user.account.id,
          );
      },
    );

    /* =====================================================
     * CONCLUIR
     *
     * Auditoria visit.completed é feita pelo VisitService.
     * =================================================== */

    typedApp.post(
      "/api/visits/:id/complete",

      {
        schema: {
          params:
            idParamsSchema,
        },
      },

      async (
        request,
        reply,
      ) => {
        const user =
          await requireOneOfPermissions(
            request,
            reply,
            options.authenticationService,
            [
              "visits.manage",
            ],
          );

        if (!user) {
          return;
        }

        return options
          .visitService
          .complete(
            request.params.id,

            user.account.id,
          );
      },
    );

    /* =====================================================
     * CANCELAR
     *
     * Auditoria visit.cancelled é feita pelo VisitService.
     * =================================================== */

    typedApp.post(
      "/api/visits/:id/cancel",

      {
        schema: {
          params:
            idParamsSchema,

          body:
            commentSchema,
        },
      },

      async (
        request,
        reply,
      ) => {
        const user =
          await requireOneOfPermissions(
            request,
            reply,
            options.authenticationService,
            [
              "visits.manage",
            ],
          );

        if (!user) {
          return;
        }

        return options
          .visitService
          .cancel(
            request.params.id,

            user.account.id,

            request.body.comment,
          );
      },
    );
  };

/* =========================================================
 * SAFE ERROR MESSAGE
 *
 * Não coloca stack, credenciais, senha SMTP ou objetos
 * completos dentro de audit_events.metadata.
 * ======================================================= */

function safeErrorMessage(
  cause:
    unknown,
) {
  if (
    cause instanceof
    Error
  ) {
    const message =
      cause.message
        .trim()
        .slice(
          0,
          300,
        );

    return (
      message ||
      "Falha não identificada."
    );
  }

  return "Falha não identificada.";
}