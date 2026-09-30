import {
  permissionAllows,
  permissionUnitIds,
  substitutionInputSchema,
  substitutionSchema,
  substitutionUpdateInputSchema,
  type AuthenticatedUser,
} from "@cge/contracts";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import { requireAnyPermission } from "../access/authorize.js";
import type { AccessService } from "../access/service.js";
import type { AuthenticationService } from "../auth/service.js";
import { userAccounts } from "../auth/schema.js";
import { auditEvents } from "../audit/schema.js";
import {
  organizationUnits,
  employmentRelationships,
  people,
} from "../people/schema.js";
import { checklists } from "../onboarding/schema.js";
import { substitutions } from "./schema.js";

const permission = "workflows.manage_substitutions";
function fail(statusCode: number, message: string): never {
  throw Object.assign(new Error(message), { statusCode });
}
export const substitutionRoutes: FastifyPluginAsync<{
  db: Database;
  authenticationService: AuthenticationService;
  accessService: AccessService;
}> = async (app, { db, authenticationService, accessService }) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  async function save(
    user: AuthenticatedUser,
    input: z.infer<typeof substitutionInputSchema>,
    existing?: { id: string; version: number },
  ) {
    return db.transaction(async (tx) => {
      const [record] = existing
        ? await tx
            .select()
            .from(substitutions)
            .where(eq(substitutions.id, existing.id))
            .for("update")
        : [];
      if (
        existing &&
        (!record ||
          !permissionAllows(user.permissions, permission, record.unitId))
      )
        fail(404, "Substituição não encontrada.");
      if (
        record &&
        (record.cancelledAt || record.version !== existing!.version)
      )
        fail(409, "A substituição foi alterada. Atualize antes de continuar.");
      if (!permissionAllows(user.permissions, permission, input.unitId))
        fail(403, "Você não pode gerenciar substituições nesta unidade.");
      const units = await tx
        .select()
        .from(organizationUnits)
        .where(
          inArray(organizationUnits.id, [
            ...new Set([input.unitId, ...(record ? [record.unitId] : [])]),
          ]),
        )
        .orderBy(asc(organizationUnits.id))
        .for("update");
      if (!units.some((unit) => unit.id === input.unitId && unit.active))
        fail(400, "Unidade indisponível.");
      const accounts = await tx
        .select({ id: userAccounts.id })
        .from(userAccounts)
        .where(
          and(
            inArray(userAccounts.id, [
              input.originalAccountId,
              input.substituteAccountId,
            ]),
            eq(userAccounts.status, "active"),
          ),
        )
        .orderBy(asc(userAccounts.id))
        .for("share");
      if (accounts.length !== 2) fail(400, "Escolha duas contas ativas.");
      const original = await accessService.resolveBasePermissions(
        input.originalAccountId,
      );
      if (
        input.flows.some(
          (flow) =>
            flow !== "checklist.assignment" &&
            !permissionAllows(original, flow, input.unitId),
        )
      )
        fail(
          400,
          "O responsável original não possui autoridade para o fluxo nesta unidade.",
        );
      if (input.flows.includes("checklist.assignment")) {
        const [assigned] = await tx
          .select({ id: checklists.id })
          .from(checklists)
          .innerJoin(
            employmentRelationships,
            eq(employmentRelationships.id, checklists.employmentId),
          )
          .where(
            and(
              eq(employmentRelationships.unitId, input.unitId),
              sql`${checklists.items} @> ${JSON.stringify([{ assigneeAccountId: input.originalAccountId }])}::jsonb`,
            ),
          )
          .limit(1);
        if (!assigned)
          fail(
            400,
            "O responsável original não possui itens atribuídos nesta unidade.",
          );
      }
      const [overlap] = await tx
        .select({ id: substitutions.id })
        .from(substitutions)
        .where(
          and(
            eq(substitutions.unitId, input.unitId),
            eq(substitutions.originalAccountId, input.originalAccountId),
            isNull(substitutions.cancelledAt),
            record ? ne(substitutions.id, record.id) : undefined,
            sql`${substitutions.startsOn} <= ${input.endsOn}::date and ${substitutions.endsOn} >= ${input.startsOn}::date`,
            or(
              ...input.flows.map(
                (flow) => sql`${substitutions.flows} ? ${flow}`,
              ),
            ),
          ),
        )
        .limit(1);
      if (overlap) fail(409, "Já existe substituição neste período e fluxo.");
      const [row] = record
        ? await tx
            .update(substitutions)
            .set({ ...input, version: record.version + 1 })
            .where(eq(substitutions.id, record.id))
            .returning()
        : await tx.insert(substitutions).values(input).returning();
      await tx.insert(auditEvents).values({
        actorAccountId: user.account.id,
        action: record ? "substitution.updated" : "substitution.created",
        objectType: "substitution",
        objectId: row!.id,
        outcome: "success",
        metadata: { ...input, version: row!.version },
      });
      return substitutionSchema.parse(row!);
    });
  }
  api.get(
    "/api/substitution-accounts",
    {
      schema: {
        querystring: z.object({
          unitId: z.uuid(),
          query: z.string().trim().min(2).max(100),
        }),
      },
    },
    async (request, reply) => {
      const user = await requireAnyPermission(
        request,
        reply,
        authenticationService,
        permission,
      );
      if (!user) return;
      if (!permissionAllows(user.permissions, permission, request.query.unitId))
        fail(403, "Você não pode gerenciar substituições nesta unidade.");
      const name = sql<string>`coalesce(${people.preferredName}, ${people.fullName})`;
      const accounts = await db
        .select({ id: userAccounts.id, name })
        .from(userAccounts)
        .innerJoin(people, eq(people.id, userAccounts.personId))
        .where(
          and(
            eq(userAccounts.status, "active"),
            or(
              ilike(people.fullName, `%${request.query.query}%`),
              ilike(people.preferredName, `%${request.query.query}%`),
            ),
          ),
        )
        .orderBy(name, userAccounts.id)
        .limit(21);
      return reply.header("Cache-Control", "no-store").send({
        accounts: accounts.slice(0, 20),
        hasMore: accounts.length > 20,
      });
    },
  );
  api.get(
    "/api/substitutions",
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().min(1).max(10000).default(1),
        }),
      },
    },
    async (request, reply) => {
      const user = await requireAnyPermission(
        request,
        reply,
        authenticationService,
        permission,
      );
      if (!user) return;
      const units = permissionUnitIds(user.permissions, permission);
      const originalAccount = alias(userAccounts, "original_account");
      const substituteAccount = alias(userAccounts, "substitute_account");
      const originalPerson = alias(people, "original_person");
      const substitutePerson = alias(people, "substitute_person");
      const rows = await db
        .select({
          record: substitutions,
          originalName: sql<string>`coalesce(${originalPerson.preferredName}, ${originalPerson.fullName})`,
          substituteName: sql<string>`coalesce(${substitutePerson.preferredName}, ${substitutePerson.fullName})`,
          unitName: organizationUnits.name,
        })
        .from(substitutions)
        .innerJoin(
          originalAccount,
          eq(originalAccount.id, substitutions.originalAccountId),
        )
        .innerJoin(
          substituteAccount,
          eq(substituteAccount.id, substitutions.substituteAccountId),
        )
        .innerJoin(
          originalPerson,
          eq(originalPerson.id, originalAccount.personId),
        )
        .innerJoin(
          substitutePerson,
          eq(substitutePerson.id, substituteAccount.personId),
        )
        .innerJoin(
          organizationUnits,
          eq(organizationUnits.id, substitutions.unitId),
        )
        .where(
          units === null
            ? undefined
            : units.length
              ? inArray(substitutions.unitId, units)
              : sql`false`,
        )
        .orderBy(desc(substitutions.createdAt), desc(substitutions.id))
        .limit(51)
        .offset((request.query.page - 1) * 50);
      const availableUnits = await db
        .select({
          id: organizationUnits.id,
          name: organizationUnits.name,
          active: organizationUnits.active,
        })
        .from(organizationUnits)
        .where(
          units === null
            ? undefined
            : units.length
              ? inArray(organizationUnits.id, units)
              : sql`false`,
        )
        .orderBy(organizationUnits.name);
      return reply.header("Cache-Control", "no-store").send({
        substitutions: rows
          .slice(0, 50)
          .map(({ record, ...names }) => ({ ...record, ...names })),
        hasMore: rows.length > 50,
        units: availableUnits,
      });
    },
  );
  api.post(
    "/api/substitutions",
    {
      schema: {
        body: substitutionInputSchema,
        response: { 201: substitutionSchema },
      },
    },
    async (request, reply) => {
      const user = await requireAnyPermission(
        request,
        reply,
        authenticationService,
        permission,
      );
      if (!user) return;
      return reply.code(201).send(await save(user, request.body));
    },
  );
  api.put(
    "/api/substitutions/:id",
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: substitutionUpdateInputSchema,
        response: { 200: substitutionSchema },
      },
    },
    async (request, reply) => {
      const user = await requireAnyPermission(
        request,
        reply,
        authenticationService,
        permission,
      );
      if (!user) return;
      const { version, ...input } = request.body;
      return save(user, input, { id: request.params.id, version });
    },
  );
  api.post(
    "/api/substitutions/:id/cancel",
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: z.strictObject({ version: z.number().int().positive() }),
      },
    },
    async (request, reply) => {
      const user = await requireAnyPermission(
        request,
        reply,
        authenticationService,
        permission,
      );
      if (!user) return;
      return db.transaction(async (tx) => {
        const [record] = await tx
          .select()
          .from(substitutions)
          .where(eq(substitutions.id, request.params.id))
          .for("update");
        if (
          !record ||
          !permissionAllows(user.permissions, permission, record.unitId)
        )
          fail(404, "Substituição não encontrada.");
        if (record.version !== request.body.version || record.cancelledAt)
          fail(
            409,
            "A substituição foi alterada. Atualize antes de continuar.",
          );
        const [updated] = await tx
          .update(substitutions)
          .set({ cancelledAt: new Date(), version: record.version + 1 })
          .where(eq(substitutions.id, record.id))
          .returning();
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: "substitution.cancelled",
          objectType: "substitution",
          objectId: record.id,
          outcome: "success",
          metadata: { version: record.version + 1 },
        });
        return updated;
      });
    },
  );
};
