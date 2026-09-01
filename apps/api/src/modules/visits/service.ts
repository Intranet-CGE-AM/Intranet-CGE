import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";

import type {
  VisitInput,
  VisitListQuery,
  VisitStatus,
  VisitUpdateInput,
} from "@cge/contracts";

import type {
  Database,
} from "../../db/client.js";

import {
  auditEvents,
} from "../audit/schema.js";

import {
  visitEvents,
  visitVisitors,
  visits,
} from "./schema.js";

/* =========================================================
 * TIPOS INTERNOS DE AUDITORIA
 * ======================================================= */

type VisitAuditAction =
  | "visit.created"
  | "visit.updated"
  | "visit.deleted"
  | "visit.approved"
  | "visit.rejected"
  | "visit.released-to-reception"
  | "visit.started"
  | "visit.completed"
  | "visit.cancelled";

/* =========================================================
 * VISIT SERVICE
 * ======================================================= */

export class VisitService {
  constructor(
    private readonly db:
      Database,
  ) {}

  /* =======================================================
   * CREATE
   *
   * Registra:
   *
   * visit_events:
   *   visit.created
   *
   * audit_events:
   *   visit.created
   * ===================================================== */

  async create(
    accountId:
      string,

    input:
      VisitInput,
  ) {
    const visitId =
      await this.db.transaction(
        async (
          tx,
        ) => {
          const protocol =
            this.generateProtocol();

          const [
            visit,
          ] =
            await tx
              .insert(
                visits,
              )
              .values({
                protocol,

                type:
                  input.type,

                subject:
                  input.subject,

                description:
                  input.description ??
                  null,

                organization:
                  input.organization,

                sector:
                  input.sector ??
                  null,

                scheduledDate:
                  input.scheduledDate,

                startTime:
                  input.startTime,

                endTime:
                  input.endTime,

                location:
                  input.location,

                responsibleUnitId:
                  input.responsibleUnitId ??
                  null,

                responsibleAccountId:
                  input.responsibleAccountId ??
                  null,

                createdByAccountId:
                  accountId,

                status:
                  "pending",
              })
              .returning();

          if (!visit) {
            throw new VisitError(
              "VISIT_CREATE_FAILED",

              "Não foi possível criar o agendamento.",

              500,
            );
          }

          /* =================================================
           * VISITANTES
           * =============================================== */

          await tx
            .insert(
              visitVisitors,
            )
            .values(
              input.visitors.map(
                (
                  visitor,
                ) => ({
                  visitId:
                    visit.id,

                  name:
                    visitor.name,

                  position:
                    visitor.position ??
                    null,

                  organization:
                    visitor.organization,

                  sector:
                    visitor.sector ??
                    null,

                  email:
                    visitor.email ??
                    null,

                  phone:
                    visitor.phone ??
                    null,

                  cpf:
                    visitor.cpf ??
                    null,
                }),
              ),
            );

          /* =================================================
           * HISTÓRICO FUNCIONAL
           * =============================================== */

          await tx
            .insert(
              visitEvents,
            )
            .values({
              visitId:
                visit.id,

              actorAccountId:
                accountId,

              type:
                "visit.created",

              comment:
                "Agendamento criado.",
            });

          /* =================================================
           * AUDITORIA CORPORATIVA
           * =============================================== */

          await tx
            .insert(
              auditEvents,
            )
            .values({
              actorAccountId:
                accountId,

              action:
                "visit.created",

              objectType:
                "visit",

              objectId:
                visit.id,

              outcome:
                "success",

              metadata:
                buildVisitAuditMetadata(
                  visit,
                  {
                    visitorCount:
                      input.visitors.length,

                    newStatus:
                      "pending",
                  },
                ),
            });

          return visit.id;
        },
      );

    return this.getById(
      visitId,
    );
  }

  /* =======================================================
   * LIST
   * ===================================================== */

  async list(
    input:
      VisitListQuery,
  ) {
    const offset =
      (
        input.page -
        1
      ) *
      input.pageSize;

    const filters =
      and(
        input.query
          ? or(
              ilike(
                visits.protocol,

                `%${input.query}%`,
              ),

              ilike(
                visits.organization,

                `%${input.query}%`,
              ),

              ilike(
                visits.subject,

                `%${input.query}%`,
              ),
            )
          : undefined,

        input.organization
          ? ilike(
              visits.organization,

              `%${input.organization}%`,
            )
          : undefined,

        input.subject
          ? ilike(
              visits.subject,

              `%${input.subject}%`,
            )
          : undefined,

        input.status
          ? eq(
              visits.status,

              input.status,
            )
          : undefined,

        input.type
          ? eq(
              visits.type,

              input.type,
            )
          : undefined,

        input.location
          ? eq(
              visits.location,

              input.location,
            )
          : undefined,

        input.dateFrom
          ? gte(
              visits.scheduledDate,

              input.dateFrom,
            )
          : undefined,

        input.dateTo
          ? lte(
              visits.scheduledDate,

              input.dateTo,
            )
          : undefined,
      );

    const [
      rows,
      countRows,
    ] =
      await Promise.all([
        this.db
          .select()
          .from(
            visits,
          )
          .where(
            filters,
          )
          .orderBy(
            desc(
              visits.scheduledDate,
            ),

            desc(
              visits.startTime,
            ),
          )
          .limit(
            input.pageSize,
          )
          .offset(
            offset,
          ),

        this.db
          .select({
            count:
              sql<number>`count(*)::int`,
          })
          .from(
            visits,
          )
          .where(
            filters,
          ),
      ]);

    const total =
      Number(
        countRows[0]
          ?.count ??
          0,
      );

    return {
      visits:
        rows.map(
          toVisitSummary,
        ),

      pagination: {
        page:
          input.page,

        pageSize:
          input.pageSize,

        total,

        totalPages:
          total ===
          0
            ? 0
            : Math.ceil(
                total /
                  input.pageSize,
              ),
      },
    };
  }

  /* =======================================================
   * GET
   * ===================================================== */

  async getById(
    id:
      string,
  ) {
    const [
      visit,
    ] =
      await this.db
        .select()
        .from(
          visits,
        )
        .where(
          eq(
            visits.id,
            id,
          ),
        )
        .limit(1);

    if (!visit) {
      throw new VisitError(
        "VISIT_NOT_FOUND",

        "Agendamento de visita não encontrado.",

        404,
      );
    }

    const [
      visitors,
      events,
    ] =
      await Promise.all([
        this.db
          .select()
          .from(
            visitVisitors,
          )
          .where(
            eq(
              visitVisitors.visitId,
              id,
            ),
          ),

        this.db
          .select()
          .from(
            visitEvents,
          )
          .where(
            eq(
              visitEvents.visitId,
              id,
            ),
          )
          .orderBy(
            desc(
              visitEvents.createdAt,
            ),
          ),
      ]);

    return {
      ...visit,

      visitors,

      events,
    };
  }

  /* =======================================================
   * UPDATE
   *
   * Registra:
   *
   * visit_events:
   *   visit.updated
   *
   * audit_events:
   *   visit.updated
   * ===================================================== */

  async update(
    id:
      string,

    accountId:
      string,

    input:
      VisitUpdateInput,
  ) {
    const current =
      await this.getById(
        id,
      );

    if (
      ![
        "pending",
        "approved",
        "scheduled",
      ].includes(
        current.status,
      )
    ) {
      throw new VisitError(
        "VISIT_NOT_EDITABLE",

        "Esta visita não pode mais ser editada.",

        409,
      );
    }

    const changedFields =
      getChangedVisitFields(
        current,
        input,
      );

    await this.db.transaction(
      async (
        tx,
      ) => {
        const [
          updated,
        ] =
          await tx
            .update(
              visits,
            )
            .set({
              ...(input.type !==
              undefined
                ? {
                    type:
                      input.type,
                  }
                : {}),

              ...(input.subject !==
              undefined
                ? {
                    subject:
                      input.subject,
                  }
                : {}),

              ...(input.description !==
              undefined
                ? {
                    description:
                      input.description ??
                      null,
                  }
                : {}),

              ...(input.organization !==
              undefined
                ? {
                    organization:
                      input.organization,
                  }
                : {}),

              ...(input.sector !==
              undefined
                ? {
                    sector:
                      input.sector ??
                      null,
                  }
                : {}),

              ...(input.scheduledDate !==
              undefined
                ? {
                    scheduledDate:
                      input.scheduledDate,
                  }
                : {}),

              ...(input.startTime !==
              undefined
                ? {
                    startTime:
                      input.startTime,
                  }
                : {}),

              ...(input.endTime !==
              undefined
                ? {
                    endTime:
                      input.endTime,
                  }
                : {}),

              ...(input.location !==
              undefined
                ? {
                    location:
                      input.location,
                  }
                : {}),

              ...(input.responsibleUnitId !==
              undefined
                ? {
                    responsibleUnitId:
                      input.responsibleUnitId ??
                      null,
                  }
                : {}),

              ...(input.responsibleAccountId !==
              undefined
                ? {
                    responsibleAccountId:
                      input.responsibleAccountId ??
                      null,
                  }
                : {}),

              updatedAt:
                new Date(),
            })
            .where(
              eq(
                visits.id,
                id,
              ),
            )
            .returning();

        if (!updated) {
          throw new VisitError(
            "VISIT_UPDATE_FAILED",

            "Não foi possível atualizar a visita.",

            500,
          );
        }

        /* =================================================
         * VISITANTES
         * =============================================== */

        if (
          input.visitors !==
          undefined
        ) {
          await tx
            .delete(
              visitVisitors,
            )
            .where(
              eq(
                visitVisitors.visitId,
                id,
              ),
            );

          await tx
            .insert(
              visitVisitors,
            )
            .values(
              input.visitors.map(
                (
                  visitor,
                ) => ({
                  visitId:
                    id,

                  name:
                    visitor.name,

                  position:
                    visitor.position ??
                    null,

                  organization:
                    visitor.organization,

                  sector:
                    visitor.sector ??
                    null,

                  email:
                    visitor.email ??
                    null,

                  phone:
                    visitor.phone ??
                    null,

                  cpf:
                    visitor.cpf ??
                    null,
                }),
              ),
            );
        }

        /* =================================================
         * HISTÓRICO FUNCIONAL
         * =============================================== */

        await tx
          .insert(
            visitEvents,
          )
          .values({
            visitId:
              id,

            actorAccountId:
              accountId,

            type:
              "visit.updated",

            comment:
              "Dados do agendamento atualizados.",
          });

        /* =================================================
         * AUDITORIA CORPORATIVA
         * =============================================== */

        await tx
          .insert(
            auditEvents,
          )
          .values({
            actorAccountId:
              accountId,

            action:
              "visit.updated",

            objectType:
              "visit",

            objectId:
              id,

            outcome:
              "success",

            metadata:
              buildVisitAuditMetadata(
                updated,
                {
                  previousStatus:
                    current.status,

                  newStatus:
                    updated.status,

                  changedFields,

                  visitorsUpdated:
                    input.visitors !==
                    undefined,

                  visitorCount:
                    input.visitors
                      ?.length ??
                    current.visitors
                      .length,
                },
              ),
          });
      },
    );

    return this.getById(
      id,
    );
  }

  /* =======================================================
   * DELETE
   *
   * IMPORTANTE:
   * agora recebe accountId para identificar quem excluiu.
   *
   * Registra audit_events ANTES da exclusão, dentro da
   * mesma transação.
   * ===================================================== */

  async remove(
    id:
      string,

    accountId:
      string,
  ) {
    const current =
      await this.getById(
        id,
      );

    if (
      ![
        "pending",
        "rejected",
        "cancelled",
      ].includes(
        current.status,
      )
    ) {
      throw new VisitError(
        "VISIT_NOT_DELETABLE",

        "Somente visitas pendentes, recusadas ou canceladas podem ser excluídas.",

        409,
      );
    }

    await this.db.transaction(
      async (
        tx,
      ) => {
        /* =================================================
         * AUDITORIA CORPORATIVA
         *
         * Deve acontecer antes do DELETE da visita.
         * audit_events.object_id não possui FK para visits.
         * =============================================== */

        await tx
          .insert(
            auditEvents,
          )
          .values({
            actorAccountId:
              accountId,

            action:
              "visit.deleted",

            objectType:
              "visit",

            objectId:
              id,

            outcome:
              "success",

            metadata:
              buildVisitAuditMetadata(
                current,
                {
                  previousStatus:
                    current.status,

                  visitorCount:
                    current.visitors
                      .length,
                },
              ),
          });

        /* =================================================
         * HISTÓRICO INTERNO
         *
         * Os eventos funcionais são apagados juntamente
         * com a própria visita, enquanto a Auditoria
         * corporativa permanece.
         * =============================================== */

        await tx
          .delete(
            visitEvents,
          )
          .where(
            eq(
              visitEvents.visitId,
              id,
            ),
          );

        await tx
          .delete(
            visitVisitors,
          )
          .where(
            eq(
              visitVisitors.visitId,
              id,
            ),
          );

        await tx
          .delete(
            visits,
          )
          .where(
            eq(
              visits.id,
              id,
            ),
          );
      },
    );

    return {
      success:
        true,
    };
  }

  /* =======================================================
   * APPROVE
   * ===================================================== */

  async approve(
    id:
      string,

    accountId:
      string,

    comment?:
      string | null,
  ) {
    return this.changeStatus({
      id,

      accountId,

      from: [
        "pending",
      ],

      to:
        "approved",

      event:
        "visit.approved",

      auditAction:
        "visit.approved",

      comment:
        comment ??
        "Visita aprovada.",
    });
  }

  /* =======================================================
   * REJECT
   * ===================================================== */

  async reject(
    id:
      string,

    accountId:
      string,

    comment?:
      string | null,
  ) {
    return this.changeStatus({
      id,

      accountId,

      from: [
        "pending",
      ],

      to:
        "rejected",

      event:
        "visit.rejected",

      auditAction:
        "visit.rejected",

      comment:
        comment ??
        "Visita recusada.",
    });
  }

  /* =======================================================
   * RELEASE TO RECEPTION
   * ===================================================== */

  async releaseToReception(
    id:
      string,

    accountId:
      string,
  ) {
    return this.changeStatus({
      id,

      accountId,

      from: [
        "pending",
        "approved",
      ],

      to:
        "scheduled",

      /*
       * Mantemos o nome já utilizado pelo histórico
       * funcional para não quebrar telas existentes.
       */
      event:
        "visit.released_reception",

      /*
       * Na Auditoria utilizamos nomenclatura
       * padronizada e legível.
       */
      auditAction:
        "visit.released-to-reception",

      comment:
        "Visita liberada para recepção.",
    });
  }

  /* =======================================================
   * START SERVICE
   * ===================================================== */

  async startService(
    id:
      string,

    accountId:
      string,
  ) {
    return this.changeStatus({
      id,

      accountId,

      from: [
        "scheduled",
      ],

      to:
        "in_progress",

      event:
        "visit.started",

      auditAction:
        "visit.started",

      comment:
        "Atendimento iniciado.",
    });
  }

  /* =======================================================
   * COMPLETE
   * ===================================================== */

  async complete(
    id:
      string,

    accountId:
      string,
  ) {
    return this.changeStatus({
      id,

      accountId,

      from: [
        "in_progress",
      ],

      to:
        "completed",

      event:
        "visit.completed",

      auditAction:
        "visit.completed",

      comment:
        "Atendimento concluído.",
    });
  }

  /* =======================================================
   * CANCEL
   * ===================================================== */

  async cancel(
    id:
      string,

    accountId:
      string,

    comment?:
      string | null,
  ) {
    return this.changeStatus({
      id,

      accountId,

      from: [
        "pending",
        "approved",
        "scheduled",
      ],

      to:
        "cancelled",

      event:
        "visit.cancelled",

      auditAction:
        "visit.cancelled",

      comment:
        comment ??
        "Agendamento cancelado.",
    });
  }

  /* =======================================================
   * DASHBOARD
   * ===================================================== */

  async dashboard() {
    const today =
      manausDate();

    const tomorrow =
      addDays(
        today,
        1,
      );

    const afterTomorrow =
      addDays(
        today,
        2,
      );

    const monthStart =
      `${today.slice(
        0,
        7,
      )}-01`;

    const nextMonthStart =
      firstDayNextMonth(
        today,
      );

    const [
      todayVisits,
      tomorrowVisits,
      upcomingVisits,
      monthVisits,
      recentTechnicalVisits,
    ] =
      await Promise.all([
        this.db
          .select()
          .from(
            visits,
          )
          .where(
            eq(
              visits.scheduledDate,
              today,
            ),
          )
          .orderBy(
            asc(
              visits.startTime,
            ),
          ),

        this.db
          .select()
          .from(
            visits,
          )
          .where(
            eq(
              visits.scheduledDate,
              tomorrow,
            ),
          )
          .orderBy(
            asc(
              visits.startTime,
            ),
          ),

        this.db
          .select()
          .from(
            visits,
          )
          .where(
            and(
              gte(
                visits.scheduledDate,

                afterTomorrow,
              ),

              inArray(
                visits.status,
                [
                  "pending",
                  "approved",
                  "scheduled",
                  "in_progress",
                ],
              ),
            ),
          )
          .orderBy(
            asc(
              visits.scheduledDate,
            ),

            asc(
              visits.startTime,
            ),
          )
          .limit(10),

        this.db
          .select()
          .from(
            visits,
          )
          .where(
            and(
              gte(
                visits.scheduledDate,

                monthStart,
              ),

              lt(
                visits.scheduledDate,

                nextMonthStart,
              ),
            ),
          ),

        this.db
          .select()
          .from(
            visits,
          )
          .where(
            and(
              eq(
                visits.type,

                "technical_visit",
              ),

              eq(
                visits.status,

                "completed",
              ),
            ),
          )
          .orderBy(
            desc(
              visits.scheduledDate,
            ),

            desc(
              visits.startTime,
            ),
          )
          .limit(6),
      ]);

    return {
      counters: {
        today:
          todayVisits.length,

        tomorrow:
          tomorrowVisits.length,

        month:
          monthVisits.length,

        pending:
          monthVisits.filter(
            (
              visit,
            ) =>
              visit.status ===
              "pending",
          ).length,

        inProgress:
          monthVisits.filter(
            (
              visit,
            ) =>
              visit.status ===
              "in_progress",
          ).length,

        completed:
          monthVisits.filter(
            (
              visit,
            ) =>
              visit.status ===
              "completed",
          ).length,
      },

      today:
        todayVisits.map(
          toVisitSummary,
        ),

      tomorrow:
        tomorrowVisits.map(
          toVisitSummary,
        ),

      upcoming:
        upcomingVisits.map(
          toVisitSummary,
        ),

      recentTechnicalVisits:
        recentTechnicalVisits.map(
          toVisitSummary,
        ),
    };
  }

  /* =======================================================
   * CHANGE STATUS
   *
   * Centraliza:
   *
   * - alteração de status;
   * - visit_events;
   * - audit_events.
   *
   * Os três passos pertencem à MESMA transação.
   * ===================================================== */

  private async changeStatus({
    id,
    accountId,
    from,
    to,
    event,
    auditAction,
    comment,
  }: {
    id:
      string;

    accountId:
      string;

    from:
      VisitStatus[];

    to:
      VisitStatus;

    event:
      string;

    auditAction:
      VisitAuditAction;

    comment:
      string;
  }) {
    const current =
      await this.getById(
        id,
      );

    if (
      !from.includes(
        current.status,
      )
    ) {
      throw new VisitError(
        "VISIT_INVALID_STATUS",

        `Não é possível alterar a visita de "${current.status}" para "${to}".`,

        409,
      );
    }

    await this.db.transaction(
      async (
        tx,
      ) => {
        const [
          updated,
        ] =
          await tx
            .update(
              visits,
            )
            .set({
              status:
                to,

              updatedAt:
                new Date(),
            })
            .where(
              eq(
                visits.id,
                id,
              ),
            )
            .returning();

        if (!updated) {
          throw new VisitError(
            "VISIT_STATUS_UPDATE_FAILED",

            "Não foi possível atualizar a situação da visita.",

            500,
          );
        }

        /* =================================================
         * HISTÓRICO FUNCIONAL
         * =============================================== */

        await tx
          .insert(
            visitEvents,
          )
          .values({
            visitId:
              id,

            actorAccountId:
              accountId,

            type:
              event,

            comment,
          });

        /* =================================================
         * AUDITORIA CORPORATIVA
         * =============================================== */

        await tx
          .insert(
            auditEvents,
          )
          .values({
            actorAccountId:
              accountId,

            action:
              auditAction,

            objectType:
              "visit",

            objectId:
              id,

            outcome:
              "success",

            metadata:
              buildVisitAuditMetadata(
                updated,
                {
                  previousStatus:
                    current.status,

                  newStatus:
                    to,

                  comment:
                    sanitizeAuditComment(
                      comment,
                    ),
                },
              ),
          });
      },
    );

    return this.getById(
      id,
    );
  }

  /* =======================================================
   * GENERATE PROTOCOL
   * ===================================================== */

  private generateProtocol() {
    const year =
      new Date()
        .getFullYear();

    const suffix =
      crypto
        .randomUUID()
        .replaceAll(
          "-",
          "",
        )
        .slice(
          0,
          8,
        )
        .toUpperCase();

    return `VIS-${year}-${suffix}`;
  }
}

/* =========================================================
 * VISIT ERROR
 * ======================================================= */

export class VisitError
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
      "VisitError";
  }
}

/* =========================================================
 * VISIT SUMMARY
 * ======================================================= */

function toVisitSummary(
  visit:
    typeof visits.$inferSelect,
) {
  return {
    id:
      visit.id,

    protocol:
      visit.protocol,

    type:
      visit.type,

    subject:
      visit.subject,

    organization:
      visit.organization,

    sector:
      visit.sector,

    scheduledDate:
      visit.scheduledDate,

    startTime:
      normalizeTime(
        visit.startTime,
      ),

    endTime:
      normalizeTime(
        visit.endTime,
      ),

    location:
      visit.location,

    status:
      visit.status,
  };
}

/* =========================================================
 * AUDIT METADATA
 *
 * NÃO colocar aqui:
 *
 * - CPF;
 * - telefone;
 * - senha;
 * - token de confirmação;
 * - hash de token;
 * - credenciais SMTP.
 *
 * Mantemos somente informações operacionais úteis.
 * ======================================================= */

function buildVisitAuditMetadata(
  visit:
    typeof visits.$inferSelect,

  extra:
    Record<
      string,
      unknown
    > = {},
): Record<
  string,
  unknown
> {
  return {
    protocol:
      visit.protocol,

    visitType:
      visit.type,

    subject:
      visit.subject,

    organization:
      visit.organization,

    sector:
      visit.sector,

    scheduledDate:
      visit.scheduledDate,

    startTime:
      normalizeTime(
        visit.startTime,
      ),

    endTime:
      normalizeTime(
        visit.endTime,
      ),

    location:
      visit.location,

    status:
      visit.status,

    responsibleUnitId:
      visit.responsibleUnitId,

    responsibleAccountId:
      visit.responsibleAccountId,

    ...extra,
  };
}

/* =========================================================
 * CAMPOS ALTERADOS
 *
 * Usado na auditoria do PATCH.
 * Não guarda os dados anteriores completos.
 * Apenas informa quais campos foram modificados.
 * ======================================================= */

function getChangedVisitFields(
  current:
    Awaited<
      ReturnType<
        VisitService["getById"]
      >
    >,

  input:
    VisitUpdateInput,
) {
  const changedFields:
    string[] = [];

  if (
    input.type !==
      undefined &&
    input.type !==
      current.type
  ) {
    changedFields.push(
      "type",
    );
  }

  if (
    input.subject !==
      undefined &&
    input.subject !==
      current.subject
  ) {
    changedFields.push(
      "subject",
    );
  }

  if (
    input.description !==
      undefined &&
    (
      input.description ??
      null
    ) !==
      current.description
  ) {
    changedFields.push(
      "description",
    );
  }

  if (
    input.organization !==
      undefined &&
    input.organization !==
      current.organization
  ) {
    changedFields.push(
      "organization",
    );
  }

  if (
    input.sector !==
      undefined &&
    (
      input.sector ??
      null
    ) !==
      current.sector
  ) {
    changedFields.push(
      "sector",
    );
  }

  if (
    input.scheduledDate !==
      undefined &&
    input.scheduledDate !==
      current.scheduledDate
  ) {
    changedFields.push(
      "scheduledDate",
    );
  }

  if (
    input.startTime !==
      undefined &&
    normalizeTime(
      input.startTime,
    ) !==
      normalizeTime(
        current.startTime,
      )
  ) {
    changedFields.push(
      "startTime",
    );
  }

  if (
    input.endTime !==
      undefined &&
    normalizeTime(
      input.endTime,
    ) !==
      normalizeTime(
        current.endTime,
      )
  ) {
    changedFields.push(
      "endTime",
    );
  }

  if (
    input.location !==
      undefined &&
    input.location !==
      current.location
  ) {
    changedFields.push(
      "location",
    );
  }

  if (
    input.responsibleUnitId !==
      undefined &&
    (
      input.responsibleUnitId ??
      null
    ) !==
      current.responsibleUnitId
  ) {
    changedFields.push(
      "responsibleUnitId",
    );
  }

  if (
    input.responsibleAccountId !==
      undefined &&
    (
      input.responsibleAccountId ??
      null
    ) !==
      current.responsibleAccountId
  ) {
    changedFields.push(
      "responsibleAccountId",
    );
  }

  if (
    input.visitors !==
    undefined
  ) {
    changedFields.push(
      "visitors",
    );
  }

  return changedFields;
}

/* =========================================================
 * COMENTÁRIO SEGURO PARA AUDITORIA
 *
 * Limita tamanho para evitar colocar texto excessivo
 * em metadata.
 * ======================================================= */

function sanitizeAuditComment(
  value:
    string,
) {
  const normalized =
    value
      .trim();

  if (
    normalized.length <=
    500
  ) {
    return normalized;
  }

  return `${normalized.slice(
    0,
    500,
  )}…`;
}

/* =========================================================
 * NORMALIZE TIME
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

/* =========================================================
 * DATA MANAUS
 * ======================================================= */

function manausDate() {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",

      {
        timeZone:
          "America/Manaus",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      },
    ).formatToParts(
      new Date(),
    );

  const year =
    parts.find(
      (
        part,
      ) =>
        part.type ===
        "year",
    )?.value;

  const month =
    parts.find(
      (
        part,
      ) =>
        part.type ===
        "month",
    )?.value;

  const day =
    parts.find(
      (
        part,
      ) =>
        part.type ===
        "day",
    )?.value;

  if (
    !year ||
    !month ||
    !day
  ) {
    throw new VisitError(
      "DATE_FORMAT_FAILED",

      "Não foi possível determinar a data atual.",

      500,
    );
  }

  return `${year}-${month}-${day}`;
}

/* =========================================================
 * PARSE ISO DATE
 * ======================================================= */

function parseIsoDate(
  value:
    string,
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value,
    );

  if (
    !match ||
    !match[1] ||
    !match[2] ||
    !match[3]
  ) {
    throw new VisitError(
      "INVALID_DATE",

      `Data inválida: ${value}`,

      400,
    );
  }

  return {
    year:
      Number(
        match[1],
      ),

    month:
      Number(
        match[2],
      ),

    day:
      Number(
        match[3],
      ),
  };
}

/* =========================================================
 * ADD DAYS
 * ======================================================= */

function addDays(
  value:
    string,

  days:
    number,
) {
  const {
    year,
    month,
    day,
  } =
    parseIsoDate(
      value,
    );

  return new Date(
    Date.UTC(
      year,
      month -
        1,
      day +
        days,
    ),
  )
    .toISOString()
    .slice(
      0,
      10,
    );
}

/* =========================================================
 * FIRST DAY NEXT MONTH
 * ======================================================= */

function firstDayNextMonth(
  value:
    string,
) {
  const {
    year,
    month,
  } =
    parseIsoDate(
      value,
    );

  return new Date(
    Date.UTC(
      year,
      month,
      1,
    ),
  )
    .toISOString()
    .slice(
      0,
      10,
    );
}