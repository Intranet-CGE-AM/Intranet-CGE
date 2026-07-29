import {
  auditPageSchema,
  auditOutcomeSchema,
  authErrorSchema,
} from "@cge/contracts";
import { and, count, desc, eq, gte, ilike, lt, or, sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { Database } from "../../db/client.js";
import type { AccessService } from "../access/service.js";
import { requirePermission } from "../access/authorize.js";
import type { AuthenticationService } from "../auth/service.js";
import { userAccounts } from "../auth/schema.js";
import { people } from "../people/schema.js";
import { auditEvents } from "./schema.js";

const filterSchema = z.object({
  query: z.string().trim().max(120).optional(),
  outcome: auditOutcomeSchema.optional(),
  action: z.string().trim().max(120).optional(),
  objectType: z.string().trim().max(80).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

const querySchema = filterSchema.extend({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

type AuditFilters = z.infer<typeof filterSchema>;

const csvCell = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

function auditWhere(filters: AuditFilters) {
  const term = filters.query?.trim();
  const pattern = term ? `%${term}%` : null;
  const from = filters.from ? new Date(`${filters.from}T00:00:00-04:00`) : null;
  const to = filters.to
    ? new Date(new Date(`${filters.to}T00:00:00-04:00`).getTime() + 86_400_000)
    : null;
  return and(
    filters.outcome ? eq(auditEvents.outcome, filters.outcome) : undefined,
    filters.action ? eq(auditEvents.action, filters.action) : undefined,
    filters.objectType
      ? eq(auditEvents.objectType, filters.objectType)
      : undefined,
    from ? gte(auditEvents.createdAt, from) : undefined,
    to ? lt(auditEvents.createdAt, to) : undefined,
    pattern
      ? or(
          ilike(auditEvents.action, pattern),
          ilike(auditEvents.objectType, pattern),
          ilike(userAccounts.email, pattern),
          ilike(people.fullName, pattern),
          sql`${auditEvents.metadata}::text ilike ${pattern}`,
        )
      : undefined,
  );
}

function auditSelect(db: Database) {
  return db
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      actorAccountId: auditEvents.actorAccountId,
      actorEmail: userAccounts.email,
      actorName: people.fullName,
      objectType: auditEvents.objectType,
      objectId: auditEvents.objectId,
      outcome: auditEvents.outcome,
      metadata: auditEvents.metadata,
      createdAt: auditEvents.createdAt,
    })
    .from(auditEvents)
    .leftJoin(userAccounts, eq(auditEvents.actorAccountId, userAccounts.id))
    .leftJoin(people, eq(userAccounts.personId, people.id))
    .$dynamic();
}

function serializeEvent(
  event: Awaited<ReturnType<typeof auditSelect>>[number],
) {
  return {
    id: event.id,
    action: event.action,
    actor:
      event.actorAccountId && event.actorEmail && event.actorName
        ? {
            accountId: event.actorAccountId,
            email: event.actorEmail,
            displayName: event.actorName,
          }
        : null,
    objectType: event.objectType,
    objectId: event.objectId,
    outcome: event.outcome as "success" | "failure" | "denied",
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString(),
  };
}

export const auditRoutes: FastifyPluginAsync<{
  accessService: AccessService;
  authenticationService: AuthenticationService;
  db: Database;
}> = async (app, options) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    "/api/audit-events",
    {
      schema: {
        querystring: querySchema,
        response: {
          200: auditPageSchema,
          401: authErrorSchema,
          403: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (
        !(await requirePermission(
          request,
          reply,
          options.authenticationService,
          options.accessService,
          "audit.read",
        ))
      ) {
        return;
      }
      const where = auditWhere(request.query);
      const [events, totals] = await Promise.all([
        auditSelect(options.db)
          .where(where)
          .orderBy(desc(auditEvents.createdAt))
          .limit(request.query.pageSize)
          .offset((request.query.page - 1) * request.query.pageSize),
        options.db
          .select({ total: count() })
          .from(auditEvents)
          .leftJoin(
            userAccounts,
            eq(auditEvents.actorAccountId, userAccounts.id),
          )
          .leftJoin(people, eq(userAccounts.personId, people.id))
          .where(where),
      ]);
      const total = totals[0]?.total ?? 0;
      return {
        events: events.map(serializeEvent),
        pagination: {
          page: request.query.page,
          pageSize: request.query.pageSize,
          total,
          totalPages: Math.ceil(total / request.query.pageSize),
        },
      };
    },
  );

  typedApp.get(
    "/api/audit-events/export",
    {
      schema: { querystring: filterSchema },
    },
    async (request, reply) => {
      if (
        !(await requirePermission(
          request,
          reply,
          options.authenticationService,
          options.accessService,
          "audit.export",
        ))
      ) {
        return;
      }
      const events = await auditSelect(options.db)
        .where(auditWhere(request.query))
        .orderBy(desc(auditEvents.createdAt))
        .limit(5_000);
      const rows = events.map((event) =>
        [
          event.id,
          event.createdAt.toISOString(),
          event.actorAccountId,
          event.actorName,
          event.actorEmail,
          event.action,
          event.objectType,
          event.objectId,
          event.outcome,
          JSON.stringify(event.metadata ?? {}),
        ]
          .map(csvCell)
          .join(","),
      );
      const csv = [
        "id,created_at,actor_account_id,actor_name,actor_email,action,object_type,object_id,outcome,metadata",
        ...rows,
      ].join("\n");
      return reply
        .header(
          "Content-Disposition",
          'attachment; filename="audit-events.csv"',
        )
        .type("text/csv; charset=utf-8")
        .send(csv);
    },
  );
};
