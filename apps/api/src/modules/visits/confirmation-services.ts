import {
  createHash,
  randomBytes,
} from "node:crypto";

import {
  and,
  eq,
} from "drizzle-orm";

import type {
  VisitorConfirmationResponse,
} from "@cge/contracts";

import type {
  Database,
} from "../../db/client.js";

import {
  auditEvents,
} from "../audit/schema.js";

import {
  visitVisitors,
  visits,
} from "./schema.js";

import {
  buildConfirmationUrl,
  sendVisitConfirmationMail,
} from "./mail.js";

/* =========================================================
 * SERVICE DE CONFIRMAÇÃO
 *
 * Responsabilidades:
 *
 * - gerar token seguro;
 * - persistir somente o hash do token;
 * - enviar e-mail ao visitante;
 * - consultar confirmação pública;
 * - confirmar presença;
 * - registrar recusa;
 * - controlar expiração;
 * - atualizar status da visita;
 * - registrar auditoria corporativa.
 * ======================================================= */

export class VisitConfirmationService {
  constructor(
    private readonly db:
      Database,
  ) {}

  /* =======================================================
   * ENVIAR CONVITE PARA UM VISITANTE
   * ===================================================== */

  async send(
    visitId:
      string,

    visitorId:
      string,
  ) {
    const record =
      await this.getVisitVisitor(
        visitId,
        visitorId,
      );

    const visitorEmail =
      record.email
        ?.trim();

    /* =====================================================
     * VALIDAR E-MAIL
     * =================================================== */

    if (
      !visitorEmail
    ) {
      throw new VisitConfirmationError(
        "VISITOR_WITHOUT_EMAIL",

        "O visitante não possui e-mail cadastrado.",

        400,
      );
    }

    /* =====================================================
     * GERAR TOKEN
     *
     * O token verdadeiro será enviado somente ao
     * visitante.
     * =================================================== */

    const token =
      randomBytes(
        32,
      ).toString(
        "hex",
      );

    /* =====================================================
     * HASH DO TOKEN
     *
     * O banco NÃO armazena o token verdadeiro.
     * =================================================== */

    const tokenHash =
      hashToken(
        token,
      );

    /* =====================================================
     * EXPIRAÇÃO
     *
     * Convite válido por 7 dias.
     * =================================================== */

    const expiresAt =
      new Date();

    expiresAt.setDate(
      expiresAt.getDate() +
        7,
    );

    /* =====================================================
     * PREPARAR CONFIRMAÇÃO NO BANCO
     *
     * Status:
     *
     * not_sent
     *      ↓
     * pending
     * =================================================== */

    await this.db
      .update(
        visitVisitors,
      )
      .set({
        confirmationStatus:
          "pending",

        confirmationTokenHash:
          tokenHash,

        confirmationSentAt:
          new Date(),

        confirmationRespondedAt:
          null,

        confirmationExpiresAt:
          expiresAt,
      })
      .where(
        and(
          eq(
            visitVisitors.id,
            visitorId,
          ),

          eq(
            visitVisitors.visitId,
            visitId,
          ),
        ),
      );

    /* =====================================================
     * URL PÚBLICA
     * =================================================== */

    const confirmationUrl =
      buildConfirmationUrl(
        token,
      );

    /* =====================================================
     * ENVIAR E-MAIL
     * =================================================== */

    try {
      const mailResult =
        await sendVisitConfirmationMail({
          visitorName:
            record.visitorName,

          visitorEmail,

          protocol:
            record.protocol,

          subject:
            record.subject,

          scheduledDate:
            record.scheduledDate,

          startTime:
            normalizeTime(
              record.startTime,
            ),

          endTime:
            normalizeTime(
              record.endTime,
            ),

          location:
            record.location,

          confirmationUrl,
        });

      return {
        visitorId,

        email:
          visitorEmail,

        sent:
          true,

        confirmationStatus:
          "pending" as const,

        messageId:
          mailResult.messageId,
      };
    } catch (
      cause
    ) {
      /* ===================================================
       * FALHA DE SMTP
       *
       * A visita NÃO será excluída.
       *
       * O visitante volta para:
       *
       * confirmation_status = not_sent
       *
       * e os dados do token são removidos.
       * ================================================= */

      await this.db
        .update(
          visitVisitors,
        )
        .set({
          confirmationStatus:
            "not_sent",

          confirmationTokenHash:
            null,

          confirmationSentAt:
            null,

          confirmationRespondedAt:
            null,

          confirmationExpiresAt:
            null,
        })
        .where(
          eq(
            visitVisitors.id,
            visitorId,
          ),
        );

      throw new VisitConfirmationError(
        "CONFIRMATION_EMAIL_FAILED",

        cause instanceof
          Error
          ? `Falha ao enviar e-mail: ${cause.message}`
          : "Falha ao enviar o e-mail de confirmação.",

        502,
      );
    }
  }

  /* =======================================================
   * ENVIAR PARA TODOS OS VISITANTES
   *
   * Chamado automaticamente após o cadastro
   * da visita e também pelo reenvio manual.
   *
   * A Auditoria de envio/reenvio permanece nas routes,
   * onde temos o usuário autenticado responsável.
   * ===================================================== */

  async sendForVisit(
    visitId:
      string,
  ) {
    const visitors =
      await this.db
        .select({
          id:
            visitVisitors.id,

          email:
            visitVisitors.email,
        })
        .from(
          visitVisitors,
        )
        .where(
          eq(
            visitVisitors.visitId,
            visitId,
          ),
        );

    const results: Array<{
      visitorId:
        string;

      email:
        string | null;

      sent:
        boolean;

      error?:
        string;
    }> = [];

    for (
      const visitor of
        visitors
    ) {
      const email =
        visitor.email
          ?.trim();

      /* ===================================================
       * SEM E-MAIL
       * ================================================= */

      if (
        !email
      ) {
        results.push({
          visitorId:
            visitor.id,

          email:
            null,

          sent:
            false,

          error:
            "Visitante sem e-mail cadastrado.",
        });

        continue;
      }

      /* ===================================================
       * ENVIAR
       * ================================================= */

      try {
        await this.send(
          visitId,
          visitor.id,
        );

        results.push({
          visitorId:
            visitor.id,

          email,

          sent:
            true,
        });
      } catch (
        cause
      ) {
        results.push({
          visitorId:
            visitor.id,

          email,

          sent:
            false,

          error:
            cause instanceof
              Error
              ? cause.message
              : "Falha no envio.",
        });
      }
    }

    return results;
  }

  /* =======================================================
   * CONSULTAR CONVITE PÚBLICO
   *
   * Utilizado quando o visitante abre:
   *
   * /confirmar-visita?token=...
   * ===================================================== */

  async getPublic(
    token:
      string,
  ) {
    const record =
      await this.findByToken(
        token,
      );

    await this.ensureNotExpired(
      record,
    );

    /* =====================================================
     * DADOS PÚBLICOS
     *
     * Não retornar:
     *
     * - CPF;
     * - telefone;
     * - e-mail;
     * - hash do token;
     * - account IDs internos.
     * =================================================== */

    return {
      visitorName:
        record.visitorName,

      organization:
        record.organization,

      protocol:
        record.protocol,

      subject:
        record.subject,

      scheduledDate:
        record.scheduledDate,

      startTime:
        normalizeTime(
          record.startTime,
        ),

      endTime:
        normalizeTime(
          record.endTime,
        ),

      location:
        record.location,

      status:
        record.confirmationStatus,
    };
  }

  /* =======================================================
   * RESPONDER AO CONVITE
   *
   * CONFIRMADO:
   *
   * visit_visitors.confirmation_status
   * =
   * confirmed
   *
   * visits.status
   * =
   * scheduled
   *
   *
   * RECUSADO:
   *
   * visit_visitors.confirmation_status
   * =
   * declined
   *
   * visits.status
   * =
   * rejected
   *
   *
   * AUDITORIA:
   *
   * confirmed
   * →
   * visit.visitor-confirmed
   *
   * declined
   * →
   * visit.visitor-declined
   * ===================================================== */

  async respond(
    token:
      string,

    input:
      VisitorConfirmationResponse,
  ) {
    /* =====================================================
     * ENCONTRAR REGISTRO PELO HASH
     * =================================================== */

    const record =
      await this.findByToken(
        token,
      );

    /* =====================================================
     * VALIDAR EXPIRAÇÃO
     * =================================================== */

    await this.ensureNotExpired(
      record,
    );

    /* =====================================================
     * IDEMPOTÊNCIA
     *
     * Se o visitante já respondeu, a mesma ação
     * não será executada novamente.
     *
     * Isso impede duplicação de Auditoria e alteração
     * repetida do banco.
     * =================================================== */

    if (
      record.confirmationStatus ===
        "confirmed" ||
      record.confirmationStatus ===
        "declined"
    ) {
      return {
        success:
          true,

        alreadyResponded:
          true,

        confirmationStatus:
          record.confirmationStatus,

        visitStatus:
          record.visitStatus,

        protocol:
          record.protocol,

        visitorName:
          record.visitorName,
      };
    }

    const now =
      new Date();

    /* =====================================================
     * STATUS SOLICITADO
     * =================================================== */

    const requestedVisitStatus =
      input.response ===
      "confirmed"
        ? "scheduled"
        : "rejected";

    /* =====================================================
     * PROTEGER STATUS OPERACIONAIS
     *
     * Se a visita já estiver:
     *
     * - em andamento;
     * - concluída;
     * - cancelada;
     *
     * a resposta do visitante é registrada, porém
     * não retornamos a visita para scheduled/rejected.
     * =================================================== */

    const statusIsProtected =
      [
        "in_progress",
        "completed",
        "cancelled",
      ].includes(
        record.visitStatus,
      );

    const resultingVisitStatus =
      statusIsProtected
        ? record.visitStatus
        : requestedVisitStatus;

    /* =====================================================
     * EVENTO DE AUDITORIA
     * =================================================== */

    const auditAction =
      input.response ===
      "confirmed"
        ? "visit.visitor-confirmed"
        : "visit.visitor-declined";

    /* =====================================================
     * TRANSAÇÃO ATÔMICA
     *
     * Dentro da mesma transação:
     *
     * 1. resposta do visitante;
     * 2. status da visita;
     * 3. Auditoria corporativa.
     *
     * Se qualquer etapa falhar, tudo será revertido.
     * =================================================== */

    await this.db.transaction(
      async (
        tx,
      ) => {
        /* =================================================
         * ATUALIZAR VISITANTE
         * =============================================== */

        await tx
          .update(
            visitVisitors,
          )
          .set({
            confirmationStatus:
              input.response,

            confirmationRespondedAt:
              now,
          })
          .where(
            eq(
              visitVisitors.id,
              record.visitorId,
            ),
          );

        /* =================================================
         * ATUALIZAR VISITA
         * =============================================== */

        if (
          !statusIsProtected
        ) {
          await tx
            .update(
              visits,
            )
            .set({
              status:
                requestedVisitStatus,

              updatedAt:
                now,
            })
            .where(
              eq(
                visits.id,
                record.visitId,
              ),
            );
        }

        /* =================================================
         * AUDITORIA CORPORATIVA
         *
         * actorAccountId = null
         *
         * porque a resposta é feita por uma pessoa externa,
         * sem uma sessão autenticada da Intranet.
         *
         * NÃO registramos:
         *
         * - token;
         * - hash;
         * - e-mail;
         * - telefone;
         * - CPF.
         * =============================================== */

        await tx
          .insert(
            auditEvents,
          )
          .values({
            actorAccountId:
              null,

            action:
              auditAction,

            objectType:
              "visit",

            objectId:
              record.visitId,

            outcome:
              "success",

            metadata: {
              protocol:
                record.protocol,

              visitId:
                record.visitId,

              visitorId:
                record.visitorId,

              response:
                input.response,

              previousVisitStatus:
                record.visitStatus,

              resultingVisitStatus,

              scheduledDate:
                record.scheduledDate,

              location:
                record.location,

              source:
                "public-confirmation",
            },
          });
      },
    );

    /* =====================================================
     * RESPOSTA PARA O FRONTEND PÚBLICO
     * =================================================== */

    return {
      success:
        true,

      alreadyResponded:
        false,

      confirmationStatus:
        input.response,

      visitStatus:
        resultingVisitStatus,

      protocol:
        record.protocol,

      visitorName:
        record.visitorName,
    };
  }

  /* =======================================================
   * CONSULTA INTERNA
   *
   * Busca visita + visitante para preparar o e-mail.
   * ===================================================== */

  private async getVisitVisitor(
    visitId:
      string,

    visitorId:
      string,
  ) {
    const [
      record,
    ] =
      await this.db
        .select({
          visitorId:
            visitVisitors.id,

          visitorName:
            visitVisitors.name,

          email:
            visitVisitors.email,

          organization:
            visitVisitors.organization,

          protocol:
            visits.protocol,

          subject:
            visits.subject,

          scheduledDate:
            visits.scheduledDate,

          startTime:
            visits.startTime,

          endTime:
            visits.endTime,

          location:
            visits.location,
        })
        .from(
          visitVisitors,
        )
        .innerJoin(
          visits,

          eq(
            visitVisitors.visitId,
            visits.id,
          ),
        )
        .where(
          and(
            eq(
              visits.id,
              visitId,
            ),

            eq(
              visitVisitors.id,
              visitorId,
            ),
          ),
        )
        .limit(
          1,
        );

    if (
      !record
    ) {
      throw new VisitConfirmationError(
        "VISITOR_NOT_FOUND",

        "Visitante não encontrado para esta visita.",

        404,
      );
    }

    return record;
  }

  /* =======================================================
   * BUSCAR PELO TOKEN
   *
   * O token enviado pelo navegador é convertido
   * novamente para SHA-256 e comparado com o hash
   * armazenado no banco.
   * ===================================================== */

  private async findByToken(
    token:
      string,
  ) {
    /* =====================================================
     * NORMALIZAR
     * =================================================== */

    const normalizedToken =
      token.trim();

    /* =====================================================
     * VALIDAÇÃO BÁSICA
     * =================================================== */

    if (
      normalizedToken.length <
      32
    ) {
      throw new VisitConfirmationError(
        "INVALID_CONFIRMATION_TOKEN",

        "Link de confirmação inválido.",

        400,
      );
    }

    /* =====================================================
     * HASH
     * =================================================== */

    const tokenHash =
      hashToken(
        normalizedToken,
      );

    /* =====================================================
     * CONSULTA
     * =================================================== */

    const [
      record,
    ] =
      await this.db
        .select({
          visitorId:
            visitVisitors.id,

          visitId:
            visitVisitors.visitId,

          visitorName:
            visitVisitors.name,

          organization:
            visitVisitors.organization,

          confirmationStatus:
            visitVisitors.confirmationStatus,

          confirmationExpiresAt:
            visitVisitors.confirmationExpiresAt,

          protocol:
            visits.protocol,

          subject:
            visits.subject,

          scheduledDate:
            visits.scheduledDate,

          startTime:
            visits.startTime,

          endTime:
            visits.endTime,

          location:
            visits.location,

          visitStatus:
            visits.status,
        })
        .from(
          visitVisitors,
        )
        .innerJoin(
          visits,

          eq(
            visitVisitors.visitId,
            visits.id,
          ),
        )
        .where(
          eq(
            visitVisitors.confirmationTokenHash,
            tokenHash,
          ),
        )
        .limit(
          1,
        );

    /* =====================================================
     * TOKEN NÃO ENCONTRADO
     * =================================================== */

    if (
      !record
    ) {
      throw new VisitConfirmationError(
        "INVALID_CONFIRMATION_TOKEN",

        "O link de confirmação é inválido ou não está mais disponível.",

        404,
      );
    }

    return record;
  }

  /* =======================================================
   * VALIDADE DO CONVITE
   *
   * Além de alterar confirmation_status para expired,
   * registra visit.confirmation-expired na Auditoria.
   * ===================================================== */

  private async ensureNotExpired(
    record: {
      visitorId:
        string;

      visitId?:
        string;

      protocol?:
        string;

      scheduledDate?:
        string;

      location?:
        string;

      confirmationStatus:
        string;

      confirmationExpiresAt:
        Date | null;
    },
  ) {
    /* =====================================================
     * SEM DATA DE EXPIRAÇÃO
     * =================================================== */

    if (
      !record.confirmationExpiresAt
    ) {
      throw new VisitConfirmationError(
        "CONFIRMATION_WITHOUT_EXPIRATION",

        "Este convite não possui prazo de validade.",

        410,
      );
    }

    /* =====================================================
     * AINDA VÁLIDO
     * =================================================== */

    if (
      record.confirmationExpiresAt
        .getTime() >=
      Date.now()
    ) {
      return;
    }

    /* =====================================================
     * EXPIRADO
     *
     * Só alteramos e auditamos quando ainda estava
     * efetivamente pending.
     *
     * Dessa forma, abrir várias vezes um link expirado
     * não gera vários eventos iguais.
     * =================================================== */

    if (
      record.confirmationStatus ===
      "pending"
    ) {
      await this.db.transaction(
        async (
          tx,
        ) => {
          /* ===============================================
           * VISITANTE
           * ============================================= */

          await tx
            .update(
              visitVisitors,
            )
            .set({
              confirmationStatus:
                "expired",
            })
            .where(
              eq(
                visitVisitors.id,
                record.visitorId,
              ),
            );

          /* ===============================================
           * AUDITORIA
           *
           * Só registramos se temos visitId.
           *
           * getPublic/respond usam findByToken(), portanto
           * normalmente esses dados estarão disponíveis.
           * ============================================= */

          if (
            record.visitId
          ) {
            await tx
              .insert(
                auditEvents,
              )
              .values({
                actorAccountId:
                  null,

                action:
                  "visit.confirmation-expired",

                objectType:
                  "visit-confirmation",

                objectId:
                  record.visitId,

                outcome:
                  "success",

                metadata: {
                  visitId:
                    record.visitId,

                  visitorId:
                    record.visitorId,

                  protocol:
                    record.protocol ??
                    null,

                  scheduledDate:
                    record.scheduledDate ??
                    null,

                  location:
                    record.location ??
                    null,

                  source:
                    "confirmation-expiration",
                },
              });
          }
        },
      );
    }

    throw new VisitConfirmationError(
      "CONFIRMATION_EXPIRED",

      "O prazo deste convite expirou.",

      410,
    );
  }
}

/* =========================================================
 * ERRO DO DOMÍNIO
 * ======================================================= */

export class VisitConfirmationError
  extends Error {
  constructor(
    readonly code:
      string,

    message:
      string,

    readonly statusCode:
      number,
  ) {
    super(
      message,
    );

    this.name =
      "VisitConfirmationError";
  }
}

/* =========================================================
 * HASH DO TOKEN
 *
 * SHA-256.
 *
 * O token verdadeiro não é armazenado.
 * ======================================================= */

function hashToken(
  token:
    string,
) {
  return createHash(
    "sha256",
  )
    .update(
      token,
    )
    .digest(
      "hex",
    );
}

/* =========================================================
 * NORMALIZAR HORÁRIO
 * ======================================================= */

function normalizeTime(
  value:
    string,
) {
  return value.slice(
    0,
    5,
  );
}