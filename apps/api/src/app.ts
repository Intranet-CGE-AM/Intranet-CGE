import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import Fastify from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";

import type { AppConfig } from "./config.js";
import type { Database } from "./db/client.js";
import { accessRoutes } from "./modules/access/routes.js";
import type { AccessService } from "./modules/access/service.js";
import { auditRoutes } from "./modules/audit/routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import type { AuthenticationService } from "./modules/auth/service.js";
import { peopleRoutes } from "./modules/people/routes.js";
import type { PeopleService } from "./modules/people/service.js";
import { systemRoutes } from "./modules/system/routes.js";

export async function buildApp({
  config,
  authenticationService,
  accessService,
  db,
  peopleService,
  readinessCheck,
  logger = false,
}: {
  config: AppConfig;
  authenticationService?: AuthenticationService;
  accessService?: AccessService;
  db?: Database;
  peopleService?: PeopleService;
  readinessCheck: () => Promise<void>;
  logger?: boolean;
}) {
  const app = Fastify({
    logger,
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cookie, {
    secret: config.SESSION_SECRET,
  });
  await app.register(rateLimit, {
    global: false,
  });
  await app.register(helmet);
  await app.register(cors, {
    credentials: true,
    origin: config.WEB_ORIGIN,
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Intranet CGE API",
        version: "0.1.0",
      },
    },
    transform: jsonSchemaTransform,
  });
  app.addHook("onRequest", async (request, reply) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      return;
    }
    if (request.headers.origin !== config.WEB_ORIGIN) {
      return reply.status(403).send({
        code: "INVALID_ORIGIN",
        message: "Origem da requisição não permitida.",
      });
    }
  });
  await app.register(systemRoutes, { readinessCheck });
  if (authenticationService) {
    await app.register(authRoutes, {
      authenticationService,
      secureCookies: config.NODE_ENV === "production",
      sessionTtlHours: config.SESSION_TTL_HOURS,
    });
  }
  if (authenticationService && accessService && db) {
    await app.register(accessRoutes, {
      accessService,
      authenticationService,
      db,
    });
    await app.register(auditRoutes, {
      accessService,
      authenticationService,
      db,
    });
    if (peopleService) {
      await app.register(peopleRoutes, {
        accessService,
        authenticationService,
        db,
        peopleService,
      });
    }
  }

  return app;
}
