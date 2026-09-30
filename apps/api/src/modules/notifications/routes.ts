import { notificationPageSchema } from "@cge/contracts";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import { requireAuthenticatedUser } from "../access/authorize.js";
import type { AuthenticationService } from "../auth/service.js";
import { notifications } from "./schema.js";

export const notificationRoutes: FastifyPluginAsync<{
  db: Database;
  authenticationService: AuthenticationService;
}> = async (app, { db, authenticationService }) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  api.get(
    "/api/notifications",
    {
      schema: {
        querystring: z.strictObject({
          page: z.coerce.number().int().min(1).default(1),
        }),
        response: { 200: notificationPageSchema },
      },
    },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const owner = eq(notifications.accountId, user.account.id);
      const [rows, totals] = await Promise.all([
        db
          .select()
          .from(notifications)
          .where(owner)
          .orderBy(desc(notifications.createdAt), desc(notifications.id))
          .limit(51)
          .offset((request.query.page - 1) * 50),
        db
          .select({ total: count() })
          .from(notifications)
          .where(and(owner, isNull(notifications.readAt))),
      ]);
      return reply.header("Cache-Control", "no-store").send({
        notifications: rows.slice(0, 50),
        unreadCount: totals[0]?.total ?? 0,
        hasMore: rows.length > 50,
      });
    },
  );
  api.post("/api/notifications/read-all", {}, async (request, reply) => {
    const user = await requireAuthenticatedUser(
      request,
      reply,
      authenticationService,
    );
    if (!user) return;
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.accountId, user.account.id),
          isNull(notifications.readAt),
        ),
      );
    return reply.status(204).send();
  });
  api.post(
    "/api/notifications/:id/read",
    { schema: { params: z.object({ id: z.uuid() }) } },
    async (request, reply) => {
      const user = await requireAuthenticatedUser(
        request,
        reply,
        authenticationService,
      );
      if (!user) return;
      const [item] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.id, request.params.id),
            eq(notifications.accountId, user.account.id),
          ),
        );
      if (!item)
        return reply
          .status(404)
          .send({ code: "NOT_FOUND", message: "Notificação não encontrada." });
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(eq(notifications.id, item.id), isNull(notifications.readAt)),
        );
      return reply.status(204).send();
    },
  );
};
