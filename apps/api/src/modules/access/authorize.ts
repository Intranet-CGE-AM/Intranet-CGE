import {
  anyPermissionAllows,
  permissionAllows,
  type PermissionKey,
} from "@cge/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";

import { readSessionToken } from "../auth/routes.js";
import type { AuthenticationService } from "../auth/service.js";
import type { AccessService } from "./service.js";

export async function requireAuthenticatedUser(
  request: FastifyRequest,
  reply: FastifyReply,
  authenticationService: AuthenticationService,
) {
  const token = readSessionToken(request);
  const user = token ? await authenticationService.authenticate(token) : null;

  if (!user) {
    await reply.status(401).send({
      code: "UNAUTHENTICATED",
      message: "Sua sessão não é válida.",
    });
    return null;
  }
  if (user.account.mustChangePassword) {
    await reply.status(403).send({
      code: "PASSWORD_CHANGE_REQUIRED",
      message: "Altere sua senha antes de continuar.",
    });
    return null;
  }
  return user;
}

export async function requirePermission(
  request: FastifyRequest,
  reply: FastifyReply,
  authenticationService: AuthenticationService,
  accessService: AccessService,
  permission: PermissionKey,
  unitId?: string,
) {
  const user = await requireAuthenticatedUser(
    request,
    reply,
    authenticationService,
  );
  if (!user) return null;
  if (!(await accessService.allows(user.account.id, permission, unitId))) {
    await reply.status(403).send({
      code: "FORBIDDEN",
      message: "Você não possui permissão para esta ação.",
    });
    return null;
  }
  return user;
}

export async function requireAnyPermission(
  request: FastifyRequest,
  reply: FastifyReply,
  authenticationService: AuthenticationService,
  permission: PermissionKey,
) {
  const user = await requireAuthenticatedUser(
    request,
    reply,
    authenticationService,
  );
  if (!user) return null;
  if (!permissionAllows(user.permissions, permission)) {
    await reply.status(403).send({
      code: "FORBIDDEN",
      message: "Você não possui permissão para esta ação.",
    });
    return null;
  }
  return user;
}

export async function requireAnyGlobalPermission(
  request: FastifyRequest,
  reply: FastifyReply,
  authenticationService: AuthenticationService,
  permissions: PermissionKey[],
) {
  const user = await requireAuthenticatedUser(
    request,
    reply,
    authenticationService,
  );
  if (!user) return null;
  if (!anyPermissionAllows(user.permissions, permissions, true)) {
    await reply.status(403).send({
      code: "FORBIDDEN",
      message: "Você não possui permissão para esta ação.",
    });
    return null;
  }
  return user;
}
