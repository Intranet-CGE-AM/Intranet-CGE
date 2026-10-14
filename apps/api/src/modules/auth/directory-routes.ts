import {
  directoryLinkSchema,
  directoryLookupSchema,
  directoryPreviewSchema,
} from "@cge/contracts";
import { and, eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { Database } from "../../db/client.js";
import { requirePermission } from "../access/authorize.js";
import type { AccessService } from "../access/service.js";
import { auditEvents } from "../audit/schema.js";
import { people } from "../people/schema.js";
import {
  AuthenticationError,
  directoryUnavailable,
  type Directory,
} from "./directory.js";
import { sessions, userAccounts } from "./schema.js";
import type { AuthenticationService } from "./service.js";

export const directoryRoutes: FastifyPluginAsync<{
  db: Database;
  directory?: Directory;
  authenticationService: AuthenticationService;
  accessService: AccessService;
}> = async (app, options) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const authorize = (
    request: Parameters<typeof requirePermission>[0],
    reply: Parameters<typeof requirePermission>[1],
  ) =>
    requirePermission(
      request,
      reply,
      options.authenticationService,
      options.accessService,
      "accounts.manage",
    );

  api.get(
    "/api/admin/directory",
    { schema: { response: { 200: z.object({ enabled: z.boolean() }) } } },
    async (request, reply) => {
      if (!(await authorize(request, reply))) return;
      return { enabled: Boolean(options.directory) };
    },
  );

  api.post(
    "/api/admin/directory/lookup",
    {
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        body: directoryLookupSchema,
        response: { 200: directoryPreviewSchema },
      },
    },
    async (request, reply) => {
      if (!(await authorize(request, reply))) return;
      if (!options.directory) throw directoryUnavailable();
      const identity = await options.directory.findByLogin(
        request.body.identifier,
      );
      if (!identity)
        throw new AuthenticationError(
          404,
          "DIRECTORY_USER_NOT_FOUND",
          "Usuário não encontrado no escopo permitido do AD.",
        );
      return identity;
    },
  );

  api.post(
    "/api/admin/directory/link",
    {
      schema: {
        body: directoryLinkSchema,
        response: { 200: z.object({ id: z.uuid() }) },
      },
    },
    async (request, reply) => {
      const actor = await authorize(request, reply);
      if (!actor) return;
      const directory = options.directory;
      if (!directory) throw directoryUnavailable();
      const identity = await directory.findByLogin(request.body.identifier);
      if (!identity?.eligible || identity.guid !== request.body.expectedGuid)
        throw new AuthenticationError(
          409,
          "DIRECTORY_IDENTITY_CHANGED",
          "A identidade não está apta ou mudou. Consulte o usuário novamente.",
        );
      try {
        return await options.db.transaction(async (tx) => {
          const [person] = await tx
            .select({ id: people.id })
            .from(people)
            .where(eq(people.id, request.body.personId))
            .for("update");
          if (!person)
            throw new AuthenticationError(
              404,
              "PERSON_NOT_FOUND",
              "Pessoa não encontrada.",
            );
          const [existing] = await tx
            .select()
            .from(userAccounts)
            .where(eq(userAccounts.personId, person.id))
            .for("update");
          if (existing?.id === actor.account.id)
            throw new AuthenticationError(
              409,
              "SELF_CONVERSION_NOT_ALLOWED",
              "Use outra conta administrativa para vincular seu próprio acesso.",
            );
          if (
            existing &&
            (existing.status !== "active" || existing.authProvider !== "local")
          )
            throw new AuthenticationError(
              409,
              "ACCOUNT_ALREADY_LINKED",
              "A conta já está vinculada ao AD ou está desativada.",
            );
          const values = {
            authProvider: "ad",
            directoryId: directory.id,
            directoryGuid: identity.guid,
            directoryUpn: identity.upn,
            directorySam: identity.samAccountName,
            directoryCheckedAt: new Date(),
            passwordHash: null,
            forcePasswordChangeAt: null,
            passwordChangedAt: null,
            email: existing?.email ?? identity.email,
            updatedAt: new Date(),
          };
          const [account] = existing
            ? await tx
                .update(userAccounts)
                .set(values)
                .where(
                  and(
                    eq(userAccounts.id, existing.id),
                    eq(userAccounts.authProvider, "local"),
                  ),
                )
                .returning({ id: userAccounts.id })
            : await tx
                .insert(userAccounts)
                .values({ ...values, personId: person.id })
                .returning({ id: userAccounts.id });
          if (!account)
            throw new AuthenticationError(
              409,
              "ACCOUNT_CHANGED",
              "A conta mudou. Atualize a página.",
            );
          await tx.delete(sessions).where(eq(sessions.accountId, account.id));
          await tx.insert(auditEvents).values({
            actorAccountId: actor.account.id,
            action: existing
              ? "account.directory-linked"
              : "account.directory-created",
            objectType: "account",
            objectId: account.id,
            outcome: "success",
            metadata: {
              personId: person.id,
              directoryId: directory.id,
              directoryGuid: identity.guid,
            },
          });
          return account;
        });
      } catch (error) {
        const cause = error as { cause?: { code?: string }; code?: string };
        if (cause.code === "23505" || cause.cause?.code === "23505")
          throw new AuthenticationError(
            409,
            "DIRECTORY_IDENTITY_IN_USE",
            "Esta identidade ou e-mail já está vinculado a outra conta.",
          );
        throw error;
      }
    },
  );
};
