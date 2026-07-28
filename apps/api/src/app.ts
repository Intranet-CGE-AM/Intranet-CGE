import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import swagger from "@fastify/swagger";
import Fastify from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";

import type { AppConfig } from "./config";
import { systemRoutes } from "./modules/system/routes";

export async function buildApp({
  config,
  readinessCheck,
  logger = false,
}: {
  config: AppConfig;
  readinessCheck: () => Promise<void>;
  logger?: boolean;
}) {
  const app = Fastify({
    logger,
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

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
  await app.register(systemRoutes, { readinessCheck });

  return app;
}
