import { authErrorSchema } from "@cge/contracts";
import { desc } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { Database } from "../../db/client.js";
import type { AccessService } from "../access/service.js";
import { requirePermission } from "../access/authorize.js";
import type { AuthenticationService } from "../auth/service.js";
import { auditEvents } from "./schema.js";

const auditEventSchema = z.object({
  id: z.uuid(),
  actorAccountId: z.uuid().nullable(),
  action: z.string(),
  objectType: z.string(),
  objectId: z.uuid().nullable(),
  outcome: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.date(),
});

const csvCell = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

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
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(200).default(100),
        }),
        response: {
          200: z.object({ events: z.array(auditEventSchema) }),
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
      const events = await options.db
        .select()
        .from(auditEvents)
        .orderBy(desc(auditEvents.createdAt))
        .limit(request.query.limit);
      return { events };
    },
  );

  typedApp.get("/api/audit-events/export", {}, async (request, reply) => {
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
    const events = await options.db
      .select()
      .from(auditEvents)
      .orderBy(desc(auditEvents.createdAt))
      .limit(5_000);
    const rows = events.map((event) =>
      [
        event.id,
        event.createdAt.toISOString(),
        event.actorAccountId,
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
      "id,created_at,actor_account_id,action,object_type,object_id,outcome,metadata",
      ...rows,
    ].join("\n");
    return reply
      .header("Content-Disposition", 'attachment; filename="audit-events.csv"')
      .type("text/csv; charset=utf-8")
      .send(csv);
  });
};
