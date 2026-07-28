import type { AuthenticatedUser, PermissionKey } from "@cge/contracts";

export function can(
  user: AuthenticatedUser,
  permission: PermissionKey,
  unitId?: string,
) {
  return user.permissions.some(
    (grant) =>
      grant.key === permission &&
      (grant.unitId === null || grant.unitId === unitId),
  );
}
