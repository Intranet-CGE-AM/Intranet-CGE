import {
  authErrorSchema,
  authSuccessSchema,
  changePasswordRequestSchema,
  loginRequestSchema,
  passwordChangedSchema,
} from "@cge/contracts";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { AuthenticationService } from "./service.js";

export const SESSION_COOKIE = "cge_session";

export function readSessionToken(request: FastifyRequest) {
  const cookie = request.cookies[SESSION_COOKIE];
  if (!cookie) {
    return null;
  }
  const unsigned = request.unsignCookie(cookie);
  return unsigned.valid ? unsigned.value : null;
}

export const authRoutes: FastifyPluginAsync<{
  authenticationService: AuthenticationService;
  secureCookies: boolean;
  sessionTtlHours: number;
}> = async (app, options) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  const cookieOptions = {
    httpOnly: true,
    path: "/",
    sameSite: "strict" as const,
    secure: options.secureCookies,
  };

  typedApp.post(
    "/api/auth/login",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
          keyGenerator: (request) => {
            const body = request.body as { email?: string } | undefined;
            return `${request.ip}:${body?.email?.trim().toLowerCase() ?? ""}`;
          },
        },
      },
      schema: {
        body: loginRequestSchema,
        response: {
          200: authSuccessSchema,
          401: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await options.authenticationService.login(request.body);
      if (!result) {
        return reply.status(401).send({
          code: "INVALID_CREDENTIALS",
          message: "E-mail ou senha inválidos.",
        });
      }

      reply.setCookie(SESSION_COOKIE, result.token, {
        ...cookieOptions,
        maxAge: options.sessionTtlHours * 60 * 60,
        signed: true,
      });
      return { user: result.user };
    },
  );

  typedApp.post(
    "/api/auth/logout",
    {
      schema: {
        response: {
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      const token = readSessionToken(request);
      if (token) {
        await options.authenticationService.logout(token);
      }
      reply.clearCookie(SESSION_COOKIE, cookieOptions);
      return reply.status(204).send(null);
    },
  );

  typedApp.get(
    "/api/auth/me",
    {
      schema: {
        response: {
          200: authSuccessSchema,
          401: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const token = readSessionToken(request);
      const user = token
        ? await options.authenticationService.authenticate(token)
        : null;

      if (!user) {
        return reply.status(401).send({
          code: "UNAUTHENTICATED",
          message: "Sua sessão não é válida.",
        });
      }
      return { user };
    },
  );

  typedApp.post(
    "/api/auth/password",
    {
      schema: {
        body: changePasswordRequestSchema,
        response: {
          200: passwordChangedSchema,
          401: authErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const token = readSessionToken(request);
      const user = token
        ? await options.authenticationService.authenticate(token)
        : null;
      if (!user) {
        return reply.status(401).send({
          code: "UNAUTHENTICATED",
          message: "Sua sessão não é válida.",
        });
      }

      const result = await options.authenticationService.changePassword(
        user.account.id,
        request.body,
      );
      if (result === "invalid-current-password") {
        return reply.status(401).send({
          code: "INVALID_CURRENT_PASSWORD",
          message: "A senha atual não confere.",
        });
      }

      reply.clearCookie(SESSION_COOKIE, cookieOptions);
      return { reauthenticate: true as const };
    },
  );
};
