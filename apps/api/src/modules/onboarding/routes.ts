import {
  checklistInputSchema,
  checklistItemActionSchema,
  checklistSchema,
  onboardingTemplateInputSchema,
  onboardingTemplateSchema,
  permissionAllows,
  permissionAllowsGlobally,
  type AuthenticatedUser,
  type ChecklistItem,
  type Delegation,
} from "@cge/contracts";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Database, Transaction } from "../../db/client.js";
import { requireAuthenticatedUser } from "../access/authorize.js";
import type { AuthenticationService } from "../auth/service.js";
import { notifications } from "../notifications/schema.js";
import { userAccounts } from "../auth/schema.js";
import { auditEvents } from "../audit/schema.js";
import {
  people,
  employmentRelationships as employment,
  organizationUnits,
} from "../people/schema.js";
import { checklists, onboardingTemplates } from "./schema.js";
import {
  checklistDelegations,
  delegationMetadata,
  type ChecklistDelegation,
} from "../substitutions/active.js";

function fail(statusCode: number, message: string): never {
  throw Object.assign(new Error(message), { statusCode });
}
const idParams = z.object({ id: z.uuid() });
type Record = typeof checklists.$inferSelect;
function delegatedItem(
  item: ChecklistItem,
  unitId: string,
  delegated: ChecklistDelegation[],
) {
  return delegated.find(
    (entry) =>
      entry.unitId === unitId &&
      entry.delegation.originalAccountId === item.assigneeAccountId,
  )?.delegation;
}
function present(
  record: Record,
  user: AuthenticatedUser,
  unitId: string,
  delegated: ChecklistDelegation[] = [],
) {
  const manages = permissionAllows(
    user.permissions,
    "onboarding.manage",
    unitId,
  );
  return checklistSchema.parse({
    ...record,
    unitId,
    items: record.items.map((item) => ({
      ...item,
      canAct:
        item.status === "pending" &&
        (manages ||
          item.assigneeAccountId === user.account.id ||
          Boolean(delegatedItem(item, unitId, delegated))),
    })),
    progress: {
      completed: record.items.filter((item) => item.status === "completed")
        .length,
      waived: record.items.filter((item) => item.status === "waived").length,
      pending: record.items.filter((item) => item.status === "pending").length,
      total: record.items.length,
    },
  });
}
function readable(
  record: Record,
  user: AuthenticatedUser,
  unitId: string,
  delegated: ChecklistDelegation[] = [],
) {
  return (
    permissionAllows(user.permissions, "onboarding.manage", unitId) ||
    record.personId === user.person.id ||
    record.items.some(
      (item) =>
        item.assigneeAccountId === user.account.id ||
        delegatedItem(item, unitId, delegated),
    )
  );
}
async function audit(
  tx: Transaction,
  user: AuthenticatedUser,
  action: string,
  objectId: string,
  metadata?: {
    itemId: string;
    action: string;
    version: number;
    delegation?: Delegation;
  },
) {
  await tx.insert(auditEvents).values({
    actorAccountId: user.account.id,
    action,
    objectType: action.startsWith("onboarding.")
      ? "onboarding_template"
      : "checklist",
    objectId,
    outcome: "success",
    metadata,
  });
}

export const onboardingRoutes: FastifyPluginAsync<{
  db: Database;
  authenticationService: AuthenticationService;
}> = async (app, { db, authenticationService }) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  async function allowedUnits(user: AuthenticatedUser) {
    return (
      await db.select({ id: organizationUnits.id }).from(organizationUnits)
    )
      .filter((unit) =>
        permissionAllows(user.permissions, "onboarding.manage", unit.id),
      )
      .map((unit) => unit.id);
  }
  const searchSchema = z.strictObject({
    query: z.string().trim().max(120).default(""),
  });
  api.get(
    "/api/checklist-people",
    { schema: { querystring: searchSchema } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      if (!permissionAllows(user.permissions, "onboarding.manage"))
        fail(403, "Você não pode iniciar checklists.");
      const units = await allowedUnits(user);
      const rows = await db
        .select({
          personId: people.id,
          name: people.fullName,
          employmentId: employment.id,
          unitName: organizationUnits.name,
          endDate: employment.endDate,
        })
        .from(employment)
        .innerJoin(people, eq(people.id, employment.personId))
        .innerJoin(
          organizationUnits,
          eq(organizationUnits.id, employment.unitId),
        )
        .where(
          and(
            units.length ? inArray(employment.unitId, units) : sql`false`,
            ilike(people.fullName, `%${request.query.query}%`),
          ),
        )
        .orderBy(asc(people.fullName), desc(employment.startDate))
        .limit(50);
      return reply.header("Cache-Control", "no-store").send({ people: rows });
    },
  );
  api.get(
    "/api/checklist-assignees",
    { schema: { querystring: searchSchema } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      if (!permissionAllows(user.permissions, "onboarding.manage"))
        fail(403, "Você não pode atribuir checklists.");
      const units = await allowedUnits(user);
      const rows = await db
        .select({
          id: userAccounts.id,
          name: people.fullName,
          unitName: organizationUnits.name,
        })
        .from(userAccounts)
        .innerJoin(people, eq(people.id, userAccounts.personId))
        .leftJoin(
          employment,
          and(eq(employment.personId, people.id), isNull(employment.endDate)),
        )
        .leftJoin(
          organizationUnits,
          eq(organizationUnits.id, employment.unitId),
        )
        .where(
          and(
            eq(userAccounts.status, "active"),
            or(
              eq(userAccounts.id, user.account.id),
              units.length ? inArray(employment.unitId, units) : sql`false`,
            ),
            ilike(people.fullName, `%${request.query.query}%`),
          ),
        )
        .orderBy(asc(people.fullName))
        .limit(50);
      return reply.header("Cache-Control", "no-store").send({ accounts: rows });
    },
  );
  api.get("/api/onboarding-templates", {}, async (request, reply) => {
    const user = await requireAuthenticatedUser(
      request,
      reply,
      authenticationService,
    );
    if (!user) return;
    if (
      !permissionAllows(user.permissions, "onboarding.manage") &&
      !permissionAllowsGlobally(user.permissions, "onboarding.manage_templates")
    )
      fail(403, "Você não pode consultar os modelos de checklist.");
    const rows = await db
      .select()
      .from(onboardingTemplates)
      .orderBy(asc(onboardingTemplates.name));
    return reply.header("Cache-Control", "no-store").send({
      templates: rows.map((row) => onboardingTemplateSchema.parse(row)),
    });
  });
  api.post(
    "/api/onboarding-templates",
    { schema: { body: onboardingTemplateInputSchema } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      if (
        !permissionAllowsGlobally(
          user.permissions,
          "onboarding.manage_templates",
        )
      )
        fail(403, "Você não pode administrar modelos de checklist.");
      const created = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(onboardingTemplates)
          .values(request.body)
          .returning();
        await audit(tx, user, "onboarding.template-created", row!.id);
        return row;
      });
      return reply.code(201).send(onboardingTemplateSchema.parse(created));
    },
  );
  api.put(
    "/api/onboarding-templates/:id",
    {
      schema: {
        params: idParams,
        body: onboardingTemplateInputSchema.extend({
          version: z.number().int().positive(),
        }),
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      if (
        !permissionAllowsGlobally(
          user.permissions,
          "onboarding.manage_templates",
        )
      )
        fail(403, "Você não pode administrar modelos de checklist.");
      const updated = await db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(onboardingTemplates)
          .where(eq(onboardingTemplates.id, request.params.id))
          .for("update");
        if (!current) fail(404, "Modelo não encontrado.");
        if (current.version !== request.body.version)
          fail(409, "O modelo mudou. Atualize antes de salvar.");
        const [row] = await tx
          .update(onboardingTemplates)
          .set({ ...request.body, version: current.version + 1 })
          .where(eq(onboardingTemplates.id, current.id))
          .returning();
        await audit(tx, user, "onboarding.template-updated", current.id);
        return row;
      });
      return onboardingTemplateSchema.parse(updated);
    },
  );
  api.post(
    "/api/checklists",
    { schema: { body: checklistInputSchema } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const result = await db.transaction(async (tx) => {
        const [relationship] = await tx
          .select()
          .from(employment)
          .where(
            and(
              eq(employment.id, request.body.employmentId),
              eq(employment.personId, request.body.personId),
            ),
          )
          .for("update");
        if (
          !relationship ||
          !permissionAllows(
            user.permissions,
            "onboarding.manage",
            relationship.unitId,
          )
        )
          fail(403, "Vínculo fora do seu escopo para iniciar checklist.");
        const [template] = await tx
          .select()
          .from(onboardingTemplates)
          .where(eq(onboardingTemplates.id, request.body.templateId))
          .for("share");
        if (!template?.active) fail(400, "Escolha um modelo ativo.");
        const activeItems = template.items
          .map((item, index) => ({ ...item, index }))
          .filter((item) => item.active);
        const assignments = new Map(
          request.body.assignments.map((item) => [
            item.itemIndex,
            item.accountId,
          ]),
        );
        if (
          !activeItems.length ||
          assignments.size !== request.body.assignments.length ||
          assignments.size !== activeItems.length ||
          activeItems.some((item) => !assignments.has(item.index))
        )
          fail(400, "Defina um responsável para cada item ativo do modelo.");
        const candidates = await tx
          .select({
            id: userAccounts.id,
            name: people.fullName,
            unitId: employment.unitId,
          })
          .from(userAccounts)
          .innerJoin(people, eq(people.id, userAccounts.personId))
          .leftJoin(
            employment,
            and(eq(employment.personId, people.id), isNull(employment.endDate)),
          )
          .where(
            and(
              eq(userAccounts.status, "active"),
              inArray(userAccounts.id, [...assignments.values()]),
            ),
          );
        const valid = candidates.filter(
          (account) =>
            account.id === user.account.id ||
            (account.unitId &&
              permissionAllows(
                user.permissions,
                "onboarding.manage",
                account.unitId,
              )),
        );
        if (
          [...assignments.values()].some(
            (id) => !valid.some((account) => account.id === id),
          )
        )
          fail(400, "Escolha responsáveis ativos dentro do seu escopo.");
        const items: ChecklistItem[] = activeItems.map((item) => {
          const account = valid.find(
            (candidate) => candidate.id === assignments.get(item.index),
          )!;
          return {
            id: randomUUID(),
            title: item.title,
            area: item.area,
            required: item.required,
            assigneeAccountId: account.id,
            assigneeName: account.name,
            status: "pending",
            completedBy: null,
            completedAt: null,
            comment: null,
          };
        });
        const [person] = await tx
          .select({ name: people.fullName })
          .from(people)
          .where(eq(people.id, relationship.personId));
        const [row] = await tx
          .insert(checklists)
          .values({
            personId: relationship.personId,
            personName: person!.name,
            employmentId: relationship.id,
            unitId: relationship.unitId,
            templateId: template.id,
            name: template.name,
            kind: template.kind,
            items,
          })
          .returning();
        await audit(tx, user, "checklist.created", row!.id);
        const recipients = [
          ...new Set(items.map((item) => item.assigneeAccountId)),
        ].filter((id) => id !== user.account.id);
        if (recipients.length)
          await tx
            .insert(notifications)
            .values(
              recipients.map((accountId) => ({
                accountId,
                type: "checklist.assigned",
                title: "Você tem itens de checklist para concluir",
                message: "Consulte suas responsabilidades na intranet.",
                href: `/rh/checklists?checklistId=${row!.id}`,
                dedupeKey: `checklist:${row!.id}:assigned`,
              })),
            )
            .onConflictDoNothing();
        return present(row!, user, relationship.unitId);
      });
      return reply.code(201).send(result);
    },
  );
  api.get(
    "/api/checklists",
    {
      schema: {
        querystring: z.strictObject({
          scope: z.enum(["mine", "team"]).default("mine"),
          personId: z.uuid().optional(),
          page: z.coerce.number().int().min(1).max(10000).default(1),
        }),
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const team = request.query.scope === "team";
      if (team && !permissionAllows(user.permissions, "onboarding.manage"))
        fail(403, "Você não pode consultar checklists da unidade.");
      const units = team ? await allowedUnits(user) : [];
      const delegated = await checklistDelegations(db, user.account.id);
      const rows = await db
        .select({ record: checklists, unitId: employment.unitId })
        .from(checklists)
        .innerJoin(employment, eq(employment.id, checklists.employmentId))
        .where(
          and(
            team
              ? units.length
                ? inArray(employment.unitId, units)
                : sql`false`
              : or(
                  eq(checklists.personId, user.person.id),
                  sql`${checklists.items} @> ${JSON.stringify([{ assigneeAccountId: user.account.id }])}::jsonb`,
                  ...delegated.map((entry) =>
                    and(
                      eq(employment.unitId, entry.unitId),
                      sql`${checklists.items} @> ${JSON.stringify([{ assigneeAccountId: entry.delegation.originalAccountId }])}::jsonb`,
                    ),
                  ),
                ),
            request.query.personId
              ? eq(checklists.personId, request.query.personId)
              : undefined,
          ),
        )
        .orderBy(desc(checklists.createdAt), desc(checklists.id))
        .limit(51)
        .offset((request.query.page - 1) * 50);
      return reply.header("Cache-Control", "no-store").send({
        checklists: rows
          .slice(0, 50)
          .map(({ record, unitId }) =>
            present(record, user, unitId, delegated),
          ),
        hasMore: rows.length > 50,
      });
    },
  );
  api.get(
    "/api/checklists/:id",
    { schema: { params: idParams } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const [row] = await db
        .select({ record: checklists, unitId: employment.unitId })
        .from(checklists)
        .innerJoin(employment, eq(employment.id, checklists.employmentId))
        .where(eq(checklists.id, request.params.id));
      const delegated = await checklistDelegations(db, user.account.id);
      if (!row || !readable(row.record, user, row.unitId, delegated))
        fail(404, "Checklist não encontrado no seu escopo.");
      return reply
        .header("Cache-Control", "no-store")
        .send(present(row.record, user, row.unitId, delegated));
    },
  );
  api.post(
    "/api/checklists/:id/items/:itemId",
    {
      schema: {
        params: idParams.extend({ itemId: z.uuid() }),
        body: checklistItemActionSchema,
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const delegated = await checklistDelegations(db, user.account.id);
      return db.transaction(async (tx) => {
        const [reference] = await tx
          .select({ employmentId: checklists.employmentId })
          .from(checklists)
          .where(eq(checklists.id, request.params.id));
        if (!reference) fail(404, "Checklist não encontrado.");
        // Mesma ordem de bloqueio da criação; lotação permanece estável durante a decisão.
        const [relationship] = await tx
          .select()
          .from(employment)
          .where(eq(employment.id, reference.employmentId))
          .for("update");
        const [record] = await tx
          .select()
          .from(checklists)
          .where(eq(checklists.id, request.params.id))
          .for("update");
        if (
          !record ||
          !relationship ||
          !readable(record, user, relationship.unitId, delegated)
        )
          fail(404, "Checklist não encontrado no seu escopo.");
        const item = record.items.find(
          (item) => item.id === request.params.itemId,
        );
        if (!item) fail(404, "Item não encontrado.");
        if (
          !permissionAllows(
            user.permissions,
            "onboarding.manage",
            relationship.unitId,
          ) &&
          item.assigneeAccountId !== user.account.id &&
          !delegatedItem(item, relationship.unitId, delegated)
        )
          fail(
            403,
            "Somente o responsável ou a Gestão de Pessoas pode atualizar este item.",
          );
        if (
          record.version !== request.body.version ||
          item.status !== "pending"
        )
          fail(409, "O checklist mudou. Atualize antes de decidir.");
        if (
          request.body.action === "waive" &&
          item.required &&
          !request.body.comment
        )
          fail(400, "Justifique a dispensa do item obrigatório.");
        const items = record.items.map((current): ChecklistItem =>
          current.id === item.id
            ? {
                ...current,
                status:
                  request.body.action === "complete" ? "completed" : "waived",
                completedBy: user.account.id,
                completedAt: new Date().toISOString(),
                comment: request.body.comment ?? null,
              }
            : current,
        );
        const [updated] = await tx
          .update(checklists)
          .set({ items, version: record.version + 1, updatedAt: new Date() })
          .where(eq(checklists.id, record.id))
          .returning();
        await audit(tx, user, "checklist.item-updated", record.id, {
          itemId: item.id,
          action: request.body.action,
          version: record.version + 1,
          ...delegationMetadata(
            user.permissions,
            "onboarding.manage",
            relationship.unitId,
          ),
          ...(item.assigneeAccountId !== user.account.id &&
          !permissionAllows(
            user.permissions,
            "onboarding.manage",
            relationship.unitId,
          )
            ? {
                delegation: delegatedItem(item, relationship.unitId, delegated),
              }
            : {}),
        });
        return present(updated!, user, relationship.unitId, delegated);
      });
    },
  );
};
