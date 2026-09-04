import { z } from "zod";

export const permissionKeys = [
  "access.manage",
  "accounts.manage",
  "audit.read",
  "audit.export",
  "people.read",
  "people.manage",
  "people.import",
  "birthdays.read",
  "vacations.create",
  "vacations.review.supervisor",
  "vacations.review.final",

  // Agendamento de Visitas
  "visits.read",
  "visits.create",
  "visits.manage",
  "visits.approve",

  // Controle de Patrimônio
  "assets.read",
  "assets.manage",
] as const;

export const permissionKeySchema = z.enum(permissionKeys);
export const permissionEffectSchema = z.enum(["allow", "deny"]);

export type PermissionKey = z.infer<typeof permissionKeySchema>;
export type PermissionEffect = z.infer<typeof permissionEffectSchema>;
export type PermissionScope = "global" | "global-or-unit";

export const permissionScopes: Record<PermissionKey, PermissionScope> = {
  "access.manage": "global",
  "accounts.manage": "global",
  "audit.read": "global",
  "audit.export": "global",
  "people.read": "global-or-unit",
  "people.manage": "global-or-unit",
  "people.import": "global",
  "birthdays.read": "global-or-unit",
  "vacations.create": "global-or-unit",
  "vacations.review.supervisor": "global-or-unit",
  "vacations.review.final": "global-or-unit",

  "visits.read": "global-or-unit",
  "visits.create": "global-or-unit",
  "visits.manage": "global-or-unit",
  "visits.approve": "global-or-unit",

  "assets.read": "global-or-unit",
  "assets.manage": "global-or-unit",
};

export type PermissionGrant = {
  effect?: PermissionEffect;
  key: PermissionKey;
  unitId: string | null;
};

export function permissionAllows(
  grants: readonly PermissionGrant[],
  permission: PermissionKey,
  unitId?: string,
) {
  const denied = grants.some(
    (grant) =>
      grant.key === permission &&
      grant.effect === "deny" &&
      (grant.unitId === null ||
        (unitId !== undefined && grant.unitId === unitId)),
  );
  if (denied) return false;
  return grants.some(
    (grant) =>
      grant.key === permission &&
      grant.effect !== "deny" &&
      (unitId === undefined ||
        grant.unitId === null ||
        grant.unitId === unitId),
  );
}

export function permissionAllowsGlobally(
  grants: readonly PermissionGrant[],
  permission: PermissionKey,
) {
  if (
    grants.some((grant) => grant.key === permission && grant.effect === "deny")
  ) {
    return false;
  }
  return grants.some(
    (grant) =>
      grant.key === permission &&
      grant.effect !== "deny" &&
      grant.unitId === null,
  );
}

export function anyPermissionAllows(
  grants: readonly PermissionGrant[],
  permissions: readonly PermissionKey[],
  global = false,
) {
  return permissions.some((permission) =>
    global
      ? permissionAllowsGlobally(grants, permission)
      : permissionAllows(grants, permission),
  );
}

export function permissionSupportsUnitScope(permission: PermissionKey) {
  return permissionScopes[permission] === "global-or-unit";
}

export function permissionUnitIds(
  grants: readonly PermissionGrant[],
  permission: PermissionKey,
) {
  if (permissionAllowsGlobally(grants, permission)) return null;
  return [
    ...new Set(
      grants
        .filter(
          (grant) =>
            grant.key === permission &&
            grant.effect !== "deny" &&
            grant.unitId !== null &&
            permissionAllows(grants, permission, grant.unitId),
        )
        .map((grant) => grant.unitId as string),
    ),
  ];
}

export const roleInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(240).nullable().optional(),
  permissions: z.array(permissionKeySchema).max(permissionKeys.length),
});

export const roleAssignmentInputSchema = z.object({
  accountId: z.uuid(),
  roleId: z.uuid(),
  unitId: z.uuid().nullable().default(null),
});

export const roleSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  permissions: z.array(permissionKeySchema),
});

export const roleAssignmentSchema = z.object({
  id: z.uuid(),
  accountId: z.uuid(),
  roleId: z.uuid(),
  unitId: z.uuid().nullable(),
});

export const permissionOverrideInputSchema = z.object({
  accountId: z.uuid(),
  permission: permissionKeySchema,
  effect: permissionEffectSchema,
  unitId: z.uuid().nullable().default(null),
});

export const permissionOverrideSchema = permissionOverrideInputSchema.extend({
  id: z.uuid(),
});

export type RoleInput = z.infer<typeof roleInputSchema>;
export type RoleAssignmentInput = z.infer<typeof roleAssignmentInputSchema>;
export type Role = z.infer<typeof roleSchema>;
export type RoleAssignment = z.infer<typeof roleAssignmentSchema>;
export type PermissionOverrideInput = z.infer<
  typeof permissionOverrideInputSchema
>;
export type PermissionOverride = z.infer<typeof permissionOverrideSchema>;
