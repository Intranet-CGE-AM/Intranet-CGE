import {
  anyPermissionAllows,
  permissionAllows,
  permissionAllowsGlobally,
  type AuthenticatedUser,
  type PermissionKey,
} from "@cge/contracts";

export type AccessRule = {
  anyOf: readonly PermissionKey[];
  global?: boolean;
};

export function can(
  user: AuthenticatedUser,
  permission: PermissionKey,
  unitId?: string,
) {
  return permissionAllows(user.permissions, permission, unitId);
}

export function canGlobally(
  user: AuthenticatedUser,
  permission: PermissionKey,
) {
  return permissionAllowsGlobally(user.permissions, permission);
}

export function canAccess(user: AuthenticatedUser, rule: AccessRule) {
  return anyPermissionAllows(user.permissions, rule.anyOf, rule.global);
}
