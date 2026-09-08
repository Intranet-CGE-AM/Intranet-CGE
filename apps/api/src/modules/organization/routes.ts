import {
  organizationSchema,
  permissionAllows,
  positionInputSchema,
  positionSchema,
} from "@cge/contracts";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import {
  requireAnyPermission,
  requireAuthenticatedUser,
} from "../access/authorize.js";
import type { AuthenticationService } from "../auth/service.js";
import { auditEvents } from "../audit/schema.js";
import {
  employmentRelationships as employment,
  organizationPositions as positions,
  organizationUnits,
  people,
} from "../people/schema.js";

const manage = "organization.manage_positions";
function fail(statusCode: number, message: string): never {
  throw Object.assign(new Error(message), { statusCode });
}

export const organizationRoutes: FastifyPluginAsync<{
  db: Database;
  authenticationService: AuthenticationService;
}> = async (app, { db, authenticationService }) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  api.put(
    "/api/organization/units/:id/parent",
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: z.strictObject({
          parentId: z.uuid().nullable(),
          expectedParentId: z.uuid().nullable(),
        }),
      },
    },
    async (request, reply) => {
      const user = await requireAnyPermission(
        request,
        reply,
        authenticationService,
        manage,
      );
      if (!user) return;
      return db.transaction(async (tx) => {
        // ponytail: bloqueio da pequena árvore inteira evita ciclos concorrentes; usar lock específico de topologia se houver alta frequência de reorganização.
        const units = await tx
          .select()
          .from(organizationUnits)
          .orderBy(organizationUnits.id)
          .for("update");
        const byId = new Map(units.map((unit) => [unit.id, unit]));
        const unit = byId.get(request.params.id);
        if (!unit || !permissionAllows(user.permissions, manage, unit.id))
          fail(404, "Unidade não encontrada no seu escopo.");
        const { parentId, expectedParentId } = request.body;
        if (parentId && !permissionAllows(user.permissions, manage, parentId))
          fail(403, "Você precisa de acesso de gestão à unidade superior.");
        if (unit.parentId !== expectedParentId)
          fail(409, "A hierarquia foi alterada. Atualize antes de continuar.");
        if (parentId && !byId.get(parentId)?.active)
          fail(400, "Unidade superior indisponível.");
        const visited = new Set([unit.id]);
        let ancestor = parentId;
        while (ancestor) {
          if (visited.has(ancestor))
            fail(
              409,
              "Uma unidade não pode ficar subordinada a si mesma ou a uma descendente.",
            );
          visited.add(ancestor);
          ancestor = byId.get(ancestor)?.parentId ?? null;
        }
        if (unit.parentId === parentId) return { id: unit.id, parentId };
        await tx
          .update(organizationUnits)
          .set({ parentId })
          .where(eq(organizationUnits.id, unit.id));
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: "organization.parent-changed",
          objectType: "organization-unit",
          objectId: unit.id,
          outcome: "success",
          metadata: { previousParentId: unit.parentId, parentId },
        });
        return { id: unit.id, parentId };
      });
    },
  );
  api.get(
    "/api/organization",
    { schema: { response: { 200: organizationSchema } } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      if (
        !permissionAllows(user.permissions, "organization.read") &&
        !permissionAllows(user.permissions, manage)
      )
        fail(403, "Você não pode consultar a estrutura organizacional.");
      const units = (
        await db
          .select()
          .from(organizationUnits)
          .orderBy(organizationUnits.name)
      ).filter(
        (unit) =>
          permissionAllows(user.permissions, "organization.read", unit.id) ||
          permissionAllows(user.permissions, manage, unit.id),
      );
      if (!units.length)
        return reply.header("Cache-Control", "no-store").send({ units: [] });
      const ids = units.map((unit) => unit.id);
      const [jobs, members] = await Promise.all([
        db
          .select()
          .from(positions)
          .where(inArray(positions.unitId, ids))
          .orderBy(positions.title, positions.code),
        db
          .select({
            id: employment.id,
            personId: people.id,
            name: sql<string>`coalesce(${people.preferredName}, ${people.fullName})`,
            jobTitle: employment.jobTitle,
            unitId: employment.unitId,
            positionId: employment.positionId,
            version: employment.version,
            supervisorRelationshipId: employment.supervisorRelationshipId,
          })
          .from(employment)
          .innerJoin(people, eq(people.id, employment.personId))
          .where(
            and(inArray(employment.unitId, ids), isNull(employment.endDate)),
          )
          .orderBy(people.fullName),
      ]);
      const chiefIds = [
        ...new Set(
          members.flatMap((member) =>
            member.supervisorRelationshipId
              ? [member.supervisorRelationshipId]
              : [],
          ),
        ),
      ];
      const chiefs = chiefIds.length
        ? await db
            .select({
              id: employment.id,
              personId: people.id,
              name: sql<string>`coalesce(${people.preferredName}, ${people.fullName})`,
            })
            .from(employment)
            .innerJoin(people, eq(people.id, employment.personId))
            .where(
              and(inArray(employment.id, chiefIds), isNull(employment.endDate)),
            )
        : [];
      await db.insert(auditEvents).values({
        actorAccountId: user.account.id,
        action: "organization.read",
        objectType: "organization",
        outcome: "success",
        metadata: { unitIds: ids },
      });
      // ponytail: quadro operacional agrupado em memória; agregar/paginar no SQL se crescer para milhares de vínculos.
      return reply.header("Cache-Control", "no-store").send({
        units: units.map((unit) => {
          const team = members.filter((member) => member.unitId === unit.id);
          return {
            ...unit,
            parentId:
              unit.parentId && ids.includes(unit.parentId)
                ? unit.parentId
                : null,
            parentOutsideScope: Boolean(
              unit.parentId && !ids.includes(unit.parentId),
            ),
            canManage: permissionAllows(user.permissions, manage, unit.id),
            chiefs: chiefs.filter((chief) =>
              team.some(
                (member) => member.supervisorRelationshipId === chief.id,
              ),
            ),
            peopleCount: team.length,
            employments: team,
            positions: jobs
              .filter((job) => job.unitId === unit.id)
              .map((job) => {
                const occupiedCount = team.filter(
                  (member) => member.positionId === job.id,
                ).length;
                return {
                  ...job,
                  occupiedCount,
                  vacancies: job.plannedCount - occupiedCount,
                };
              }),
          };
        }),
      });
    },
  );
  api.post(
    "/api/organization/positions",
    {
      schema: { body: positionInputSchema, response: { 201: positionSchema } },
    },
    async (request, reply) => {
      const user = await requireAnyPermission(
        request,
        reply,
        authenticationService,
        manage,
      );
      if (!user) return;
      const input = request.body;
      if (!permissionAllows(user.permissions, manage, input.unitId))
        fail(403, "Você não pode gerenciar cargos nesta unidade.");
      const created = await db.transaction(async (tx) => {
        const [unit] = await tx
          .select()
          .from(organizationUnits)
          .where(eq(organizationUnits.id, input.unitId))
          .for("share");
        if (!unit?.active) fail(400, "Unidade indisponível.");
        const [record] = await tx
          .insert(positions)
          .values(input)
          .onConflictDoNothing()
          .returning();
        if (!record)
          fail(409, "Já existe um cargo com este código na unidade.");
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: "organization.position-created",
          objectType: "position",
          objectId: record!.id,
          outcome: "success",
          metadata: input,
        });
        return record!;
      });
      return reply.code(201).send(created);
    },
  );
  api.put(
    "/api/organization/positions/:id",
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: positionInputSchema.extend({
          version: z.number().int().positive(),
          confirmBelowOccupancy: z.boolean().optional(),
        }),
        response: { 200: positionSchema },
      },
    },
    async (request, reply) => {
      const user = await requireAnyPermission(
        request,
        reply,
        authenticationService,
        manage,
      );
      if (!user) return;
      return db
        .transaction(async (tx) => {
          const [before] = await tx
            .select()
            .from(positions)
            .where(eq(positions.id, request.params.id))
            .for("update");
          if (
            !before ||
            !permissionAllows(user.permissions, manage, before.unitId)
          )
            fail(404, "Cargo não encontrado no seu escopo.");
          const { version, confirmBelowOccupancy, ...input } = request.body;
          if (version !== before.version)
            fail(409, "O cargo foi alterado. Atualize antes de continuar.");
          if (input.unitId !== before.unitId)
            fail(400, "O cargo deve permanecer na unidade de origem.");
          const [count] = await tx
            .select({ value: sql<number>`count(*)::int` })
            .from(employment)
            .where(
              and(
                eq(employment.positionId, before.id),
                isNull(employment.endDate),
              ),
            );
          const occupiedCount = count!.value;
          if (!input.active && occupiedCount)
            fail(
              409,
              "Remova as associações ativas antes de inativar o cargo.",
            );
          if (
            input.plannedCount < before.plannedCount &&
            input.plannedCount < occupiedCount &&
            !confirmBelowOccupancy
          )
            fail(
              409,
              `A redução deixa ${occupiedCount - input.plannedCount} vínculo(s) acima do previsto. Confirme para continuar; nenhum vínculo será excluído.`,
            );
          const [record] = await tx
            .update(positions)
            .set({ ...input, version: version + 1 })
            .where(eq(positions.id, before.id))
            .returning();
          await tx.insert(auditEvents).values({
            actorAccountId: user.account.id,
            action: "organization.position-updated",
            objectType: "position",
            objectId: before.id,
            outcome: "success",
            metadata: {
              previous: before,
              next: input,
              version: version + 1,
              occupiedCount,
              confirmBelowOccupancy: confirmBelowOccupancy ?? false,
            },
          });
          return record!;
        })
        .catch((error: unknown) => {
          const failure = error as { code?: string; cause?: { code?: string } };
          if ((failure.cause?.code ?? failure.code) === "23505")
            fail(409, "Já existe um cargo com este código na unidade.");
          throw error;
        });
    },
  );
  api.post(
    "/api/organization/employments/:id/position",
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: z.strictObject({
          positionId: z.uuid().nullable(),
          version: z.number().int().positive(),
        }),
      },
    },
    async (request, reply) => {
      const user = await requireAnyPermission(
        request,
        reply,
        authenticationService,
        manage,
      );
      if (!user) return;
      return db.transaction(async (tx) => {
        const [reference] = await tx
          .select({ personId: employment.personId })
          .from(employment)
          .where(eq(employment.id, request.params.id));
        if (!reference) fail(404, "Vínculo não encontrado.");
        await tx
          .select({ id: people.id })
          .from(people)
          .where(eq(people.id, reference.personId))
          .for("update");
        const [record] = await tx
          .select()
          .from(employment)
          .where(eq(employment.id, request.params.id))
          .for("update");
        if (
          !record ||
          record.endDate ||
          !permissionAllows(user.permissions, manage, record.unitId)
        )
          fail(404, "Vínculo ativo não encontrado no seu escopo.");
        if (record.version !== request.body.version)
          fail(409, "O vínculo foi alterado. Atualize antes de continuar.");
        const ids = [
          ...new Set(
            [record.positionId, request.body.positionId].filter(
              (id): id is string => Boolean(id),
            ),
          ),
        ];
        const locked = ids.length
          ? await tx
              .select()
              .from(positions)
              .where(inArray(positions.id, ids))
              .orderBy(asc(positions.id))
              .for("update")
          : [];
        if (
          request.body.positionId &&
          !locked.some(
            (job) =>
              job.id === request.body.positionId &&
              job.unitId === record.unitId &&
              job.active,
          )
        )
          fail(400, "Cargo indisponível nesta unidade.");
        const [updated] = await tx
          .update(employment)
          .set({
            positionId: request.body.positionId,
            version: record.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(employment.id, record.id))
          .returning({
            id: employment.id,
            positionId: employment.positionId,
            jobTitle: employment.jobTitle,
            version: employment.version,
          });
        await tx.insert(auditEvents).values({
          actorAccountId: user.account.id,
          action: "organization.position-assigned",
          objectType: "employment",
          objectId: record.id,
          outcome: "success",
          metadata: {
            previousPositionId: record.positionId,
            positionId: request.body.positionId,
            version: updated!.version,
          },
        });
        return updated;
      });
    },
  );
};
