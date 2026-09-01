import {
  visitorConfirmationResponseSchema,
} from "@cge/contracts";

import type {
  FastifyInstance,
  FastifyReply,
} from "fastify";

import type {
  Database,
} from "../../db/client.js";

import {
  VisitConfirmationError,
  VisitConfirmationService,
} from "./confirmation-services.js";

/* =========================================================
 * OPTIONS
 * ======================================================= */

type VisitConfirmationRoutesOptions = {
  db:
    Database;
};

/* =========================================================
 * PARAMS
 * ======================================================= */

type ConfirmationTokenParams = {
  token:
    string;
};

/* =========================================================
 * ROTAS PÚBLICAS DE CONFIRMAÇÃO
 *
 * Essas rotas não exigem autenticação da Intranet.
 *
 * O visitante acessa por meio do token recebido
 * no e-mail de confirmação.
 * ======================================================= */

export async function visitConfirmationRoutes(
  app:
    FastifyInstance,

  options:
    VisitConfirmationRoutesOptions,
) {
  /* =======================================================
   * SERVICE
   * ===================================================== */

  const confirmationService =
    new VisitConfirmationService(
      options.db,
    );

  /* =======================================================
   * GET
   *
   * CONSULTAR CONVITE
   *
   * Exemplo:
   *
   * GET
   * /api/public/visit-confirmations/:token
   *
   * Utilizado pela página:
   *
   * /confirmar-visita?token=...
   * ===================================================== */

  app.get(
    "/api/public/visit-confirmations/:token",

    async (
      request,
      reply,
    ) => {
      const {
        token,
      } =
        request.params as
          ConfirmationTokenParams;

      /* ===================================================
       * VALIDAR TOKEN BÁSICO
       * ================================================= */

      const normalizedToken =
        token
          ?.trim();

      if (
        !normalizedToken
      ) {
        return reply
          .status(400)
          .send({
            code:
              "INVALID_CONFIRMATION_TOKEN",

            message:
              "Link de confirmação inválido.",
          });
      }

      /* ===================================================
       * CONSULTAR
       * ================================================= */

      try {
        const result =
          await confirmationService
            .getPublic(
              normalizedToken,
            );

        return reply
          .status(200)
          .send(
            result,
          );
      } catch (
        cause
      ) {
        return handleConfirmationError(
          request,
          reply,
          cause,
        );
      }
    },
  );

  /* =======================================================
   * POST
   *
   * RESPONDER AO CONVITE
   *
   * CONFIRMAR:
   *
   * {
   *   "response": "confirmed"
   * }
   *
   * RECUSAR:
   *
   * {
   *   "response": "declined"
   * }
   *
   * Endpoint:
   *
   * POST
   * /api/public/visit-confirmations/:token
   *
   * A lógica de:
   *
   * - atualização do visitante;
   * - atualização da visita;
   * - Auditoria;
   *
   * está centralizada em:
   *
   * VisitConfirmationService.respond()
   * ===================================================== */

  app.post(
    "/api/public/visit-confirmations/:token",

    async (
      request,
      reply,
    ) => {
      const {
        token,
      } =
        request.params as
          ConfirmationTokenParams;

      /* ===================================================
       * VALIDAR TOKEN BÁSICO
       * ================================================= */

      const normalizedToken =
        token
          ?.trim();

      if (
        !normalizedToken
      ) {
        return reply
          .status(400)
          .send({
            code:
              "INVALID_CONFIRMATION_TOKEN",

            message:
              "Link de confirmação inválido.",
          });
      }

      /* ===================================================
       * VALIDAR BODY
       * ================================================= */

      const parsed =
        visitorConfirmationResponseSchema
          .safeParse(
            request.body,
          );

      if (
        !parsed.success
      ) {
        return reply
          .status(400)
          .send({
            code:
              "INVALID_CONFIRMATION_RESPONSE",

            message:
              "Resposta de confirmação inválida.",
          });
      }

      /* ===================================================
       * PROCESSAR RESPOSTA
       *
       * O service realiza:
       *
       * confirmed
       *     ↓
       * visit_visitors.confirmation_status = confirmed
       * visits.status = scheduled
       * audit_events = visit.visitor-confirmed
       *
       *
       * declined
       *     ↓
       * visit_visitors.confirmation_status = declined
       * visits.status = rejected
       * audit_events = visit.visitor-declined
       * ================================================= */

      try {
        const result =
          await confirmationService
            .respond(
              normalizedToken,

              parsed.data,
            );

        return reply
          .status(200)
          .send(
            result,
          );
      } catch (
        cause
      ) {
        return handleConfirmationError(
          request,
          reply,
          cause,
        );
      }
    },
  );
}

/* =========================================================
 * ERROR HANDLER
 * ======================================================= */

function handleConfirmationError(
  request:
    {
      log: {
        error:
          (
            payload:
              unknown,

            message?:
              string,
          ) =>
            void;
      };
    },

  reply:
    FastifyReply,

  cause:
    unknown,
) {
  /* =======================================================
   * ERROS DE DOMÍNIO
   * ===================================================== */

  if (
    cause instanceof
    VisitConfirmationError
  ) {
    return reply
      .status(
        cause.statusCode,
      )
      .send({
        code:
          cause.code,

        message:
          cause.message,
      });
  }

  /* =======================================================
   * ERRO NÃO TRATADO
   *
   * Não expomos detalhes técnicos ao visitante.
   * ===================================================== */

  request.log.error(
    {
      err:
        cause,
    },

    "Erro ao processar confirmação pública de visita",
  );

  return reply
    .status(500)
    .send({
      code:
        "VISIT_CONFIRMATION_INTERNAL_ERROR",

      message:
        "Não foi possível processar a confirmação da visita.",
    });
}