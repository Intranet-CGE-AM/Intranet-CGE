import type {
  VacationDecisionInput,
  VacationRequestInput,
} from "@cge/contracts";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { userAccounts } from "../auth/schema.js";
import {
  employmentCategories,
  employmentRelationships,
  organizationUnits,
  people,
} from "../people/schema.js";
import { vacationRequestEvents, vacationRequests } from "./schema.js";
import { canCancelVacation, decisionStatus } from "./state.js";

type VacationStatus =
  | "draft"
  | "submitted"
  | "supervisor_approved"
  | "supervisor_rejected"
  | "final_approved"
  | "final_rejected"
  | "cancelled";

export class VacationError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: 400 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

export class VacationService {
  constructor(private readonly db: Database) {}

  async list(
    accountId: string,
    scope: "mine" | "supervisor" | "final",
    unitIds: string[] | null,
  ) {
    const actorPersonId = await this.actorPersonId(accountId);
    if (!actorPersonId) {
      return [];
    }
    const supervisorIds =
      scope === "supervisor"
        ? await this.db
            .select({ id: employmentRelationships.id })
            .from(employmentRelationships)
            .where(eq(employmentRelationships.personId, actorPersonId))
        : [];
    const rows = await this.db
      .select({
        id: vacationRequests.id,
        startDate: vacationRequests.startDate,
        endDate: vacationRequests.endDate,
        status: vacationRequests.status,
        version: vacationRequests.version,
        personId: people.id,
        fullName: people.fullName,
        preferredName: people.preferredName,
        unitId: organizationUnits.id,
        unitName: organizationUnits.name,
        createdAt: vacationRequests.createdAt,
        updatedAt: vacationRequests.updatedAt,
      })
      .from(vacationRequests)
      .innerJoin(
        employmentRelationships,
        eq(
          vacationRequests.employmentRelationshipId,
          employmentRelationships.id,
        ),
      )
      .innerJoin(people, eq(employmentRelationships.personId, people.id))
      .innerJoin(
        organizationUnits,
        eq(employmentRelationships.unitId, organizationUnits.id),
      )
      .where(
        and(
          scope === "mine"
            ? eq(people.id, actorPersonId)
            : scope === "supervisor"
              ? supervisorIds.length
                ? and(
                    inArray(
                      vacationRequests.supervisorRelationshipId,
                      supervisorIds.map((item) => item.id),
                    ),
                    eq(vacationRequests.status, "submitted"),
                  )
                : sql`false`
              : eq(vacationRequests.status, "supervisor_approved"),
          unitIds === null
            ? undefined
            : unitIds.length
              ? inArray(employmentRelationships.unitId, unitIds)
              : sql`false`,
        ),
      )
      .orderBy(asc(vacationRequests.startDate));

    const events = rows.length
      ? await this.db
          .select()
          .from(vacationRequestEvents)
          .where(
            inArray(
              vacationRequestEvents.vacationRequestId,
              rows.map((row) => row.id),
            ),
          )
          .orderBy(asc(vacationRequestEvents.createdAt))
      : [];
    return rows.map((row) => ({
      id: row.id,
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
      version: row.version,
      requester: {
        personId: row.personId,
        displayName: row.preferredName ?? row.fullName,
        unitId: row.unitId,
        unitName: row.unitName,
      },
      events: events
        .filter((event) => event.vacationRequestId === row.id)
        .map((event) => ({
          id: event.id,
          actorAccountId: event.actorAccountId,
          type: event.type,
          comment: event.comment,
          metadata: event.metadata,
          createdAt: event.createdAt,
        })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async create(accountId: string, input: VacationRequestInput) {
    const employment = await this.activeEmployment(accountId);
    if (!employment) {
      throw new VacationError(
        "NO_ACTIVE_EMPLOYMENT",
        400,
        "Não há vínculo funcional ativo.",
      );
    }
    if (!employment.vacationEligible) {
      throw new VacationError(
        "VACATION_NOT_ELIGIBLE",
        403,
        "A categoria funcional não está habilitada para esta solicitação.",
      );
    }
    if (input.submit && !employment.supervisorRelationshipId) {
      throw new VacationError(
        "SUPERVISOR_REQUIRED",
        400,
        "Defina a chefia imediata antes de enviar a solicitação.",
      );
    }

    return this.db.transaction(async (transaction) => {
      const [request] = await transaction
        .insert(vacationRequests)
        .values({
          employmentRelationshipId: employment.id,
          supervisorRelationshipId: input.submit
            ? employment.supervisorRelationshipId
            : null,
          startDate: input.startDate,
          endDate: input.endDate,
          status: input.submit ? "submitted" : "draft",
        })
        .returning();
      if (!request) {
        throw new Error("Vacation request was not created");
      }
      await transaction.insert(vacationRequestEvents).values([
        {
          vacationRequestId: request.id,
          actorAccountId: accountId,
          type: "created",
        },
        ...(input.submit
          ? [
              {
                vacationRequestId: request.id,
                actorAccountId: accountId,
                type: "submitted",
                metadata: {
                  supervisorRelationshipId: employment.supervisorRelationshipId,
                },
              },
            ]
          : []),
      ]);
      return request;
    });
  }

  async submit(id: string, accountId: string, version: number) {
    const context = await this.context(id);
    await this.assertRequester(context, accountId);
    const employment = await this.activeEmployment(accountId);
    if (!employment?.vacationEligible) {
      throw new VacationError(
        "VACATION_NOT_ELIGIBLE",
        403,
        "A categoria funcional não está habilitada para esta solicitação.",
      );
    }
    if (!employment.supervisorRelationshipId) {
      throw new VacationError(
        "SUPERVISOR_REQUIRED",
        400,
        "Defina a chefia imediata antes de enviar a solicitação.",
      );
    }
    return this.transition(
      id,
      accountId,
      version,
      "draft",
      "submitted",
      "submitted",
      null,
      { supervisorRelationshipId: employment.supervisorRelationshipId },
      employment.supervisorRelationshipId,
    );
  }

  async supervisorDecision(
    id: string,
    accountId: string,
    input: VacationDecisionInput,
  ) {
    const context = await this.context(id);
    if (!context.supervisorRelationshipId) {
      throw new VacationError(
        "SUPERVISOR_REQUIRED",
        409,
        "A solicitação não possui chefia responsável.",
      );
    }
    const supervisorAccountId = await this.accountForEmployment(
      context.supervisorRelationshipId,
    );
    if (supervisorAccountId !== accountId) {
      throw new VacationError(
        "NOT_REQUEST_SUPERVISOR",
        403,
        "A solicitação está atribuída a outra chefia.",
      );
    }
    const approved = input.decision === "approve";
    return this.transition(
      id,
      accountId,
      input.version,
      "submitted",
      decisionStatus("supervisor", input.decision),
      approved ? "supervisor-approved" : "supervisor-rejected",
      input.comment ?? null,
    );
  }

  async finalDecision(
    id: string,
    accountId: string,
    input: VacationDecisionInput,
  ) {
    const approved = input.decision === "approve";
    return this.transition(
      id,
      accountId,
      input.version,
      "supervisor_approved",
      decisionStatus("final", input.decision),
      approved ? "final-approved" : "final-rejected",
      input.comment ?? null,
    );
  }

  async cancel(id: string, accountId: string, version: number) {
    const context = await this.context(id);
    await this.assertRequester(context, accountId);
    if (!canCancelVacation(context.status)) {
      throw new VacationError(
        "INVALID_VACATION_STATE",
        409,
        "Esta solicitação não pode mais ser cancelada.",
      );
    }
    return this.transition(
      id,
      accountId,
      version,
      context.status,
      "cancelled",
      "cancelled",
    );
  }

  async context(id: string) {
    const [context] = await this.db
      .select({
        id: vacationRequests.id,
        requesterPersonId: employmentRelationships.personId,
        unitId: employmentRelationships.unitId,
        status: vacationRequests.status,
        supervisorRelationshipId: vacationRequests.supervisorRelationshipId,
        version: vacationRequests.version,
      })
      .from(vacationRequests)
      .innerJoin(
        employmentRelationships,
        eq(
          vacationRequests.employmentRelationshipId,
          employmentRelationships.id,
        ),
      )
      .where(eq(vacationRequests.id, id))
      .limit(1);
    if (!context) {
      throw new VacationError(
        "VACATION_NOT_FOUND",
        404,
        "Solicitação não encontrada.",
      );
    }
    return context;
  }

  private async transition(
    id: string,
    accountId: string,
    version: number,
    from: VacationStatus,
    to: VacationStatus,
    eventType: string,
    comment: string | null = null,
    metadata?: Record<string, unknown>,
    supervisorRelationshipId?: string,
  ) {
    return this.db.transaction(async (transaction) => {
      const [request] = await transaction
        .update(vacationRequests)
        .set({
          status: to,
          version: version + 1,
          updatedAt: new Date(),
          ...(supervisorRelationshipId ? { supervisorRelationshipId } : {}),
        })
        .where(
          and(
            eq(vacationRequests.id, id),
            eq(vacationRequests.status, from),
            eq(vacationRequests.version, version),
          ),
        )
        .returning();
      if (!request) {
        throw new VacationError(
          "STALE_VACATION_REQUEST",
          409,
          "A solicitação foi alterada. Atualize a página e tente novamente.",
        );
      }
      await transaction.insert(vacationRequestEvents).values({
        vacationRequestId: id,
        actorAccountId: accountId,
        type: eventType,
        comment,
        metadata,
      });
      return request;
    });
  }

  private async assertRequester(
    context: { requesterPersonId: string },
    accountId: string,
  ) {
    if ((await this.actorPersonId(accountId)) !== context.requesterPersonId) {
      throw new VacationError(
        "NOT_VACATION_REQUESTER",
        403,
        "Somente o solicitante pode executar esta ação.",
      );
    }
  }

  private async actorPersonId(accountId: string) {
    const [account] = await this.db
      .select({ personId: userAccounts.personId })
      .from(userAccounts)
      .where(eq(userAccounts.id, accountId))
      .limit(1);
    return account?.personId ?? null;
  }

  private async accountForEmployment(employmentId: string) {
    const [account] = await this.db
      .select({ accountId: userAccounts.id })
      .from(employmentRelationships)
      .innerJoin(
        userAccounts,
        eq(employmentRelationships.personId, userAccounts.personId),
      )
      .where(
        and(
          eq(employmentRelationships.id, employmentId),
          eq(userAccounts.status, "active"),
        ),
      )
      .limit(1);
    return account?.accountId ?? null;
  }

  private async activeEmployment(accountId: string) {
    const [employment] = await this.db
      .select({
        id: employmentRelationships.id,
        supervisorRelationshipId:
          employmentRelationships.supervisorRelationshipId,
        vacationEligible: employmentCategories.vacationEligible,
      })
      .from(userAccounts)
      .innerJoin(people, eq(userAccounts.personId, people.id))
      .innerJoin(
        employmentRelationships,
        and(
          eq(employmentRelationships.personId, people.id),
          isNull(employmentRelationships.endDate),
        ),
      )
      .innerJoin(
        employmentCategories,
        eq(employmentRelationships.categoryId, employmentCategories.id),
      )
      .where(eq(userAccounts.id, accountId))
      .limit(1);
    return employment ?? null;
  }
}
