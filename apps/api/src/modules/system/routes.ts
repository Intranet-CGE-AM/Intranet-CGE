import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const statusSchema = z.object({
  status: z.enum(["ok", "unavailable"]),
});

export const systemRoutes: FastifyPluginAsync<{
  readinessCheck: () => Promise<void>;
}> = async (app, options) => {
  app.get(
    "/healthz",
    {
      schema: {
        response: {
          200: statusSchema,
        },
      },
    },
    async () => ({ status: "ok" as const }),
  );

  app.get(
    "/readyz",
    {
      schema: {
        response: {
          200: statusSchema,
          503: statusSchema,
        },
      },
    },
    async (_request, reply) => {
      try {
        await options.readinessCheck();
        return { status: "ok" as const };
      } catch {
        return reply.status(503).send({ status: "unavailable" });
      }
    },
  );
};
