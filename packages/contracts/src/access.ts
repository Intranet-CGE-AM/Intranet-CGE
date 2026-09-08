import { z } from "zod";
import type { Delegation } from "./substitutions.js";

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
  "hr_requests.create",
  "hr_requests.manage",
  "documents.read",
  "documents.manage",
  "documents.sensitive.read",
  "documents.sensitive.manage",
  "employment.manage_history",
  "occurrences.create",
  "occurrences.review.supervisor",
  "occurrences.review.final",
  "occurrences.manage_types",
  "training.create",
  "training.review",
  "onboarding.manage_templates",
  "onboarding.manage",
  "workflows.manage_substitutions",
  "organization.read",
  "organization.manage_positions",
  "hr_communications.manage",
  "hr_resources.manage",
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
  "hr_requests.create": "global-or-unit",
  "hr_requests.manage": "global-or-unit",
  "documents.read": "global-or-unit",
  "documents.manage": "global-or-unit",
  "documents.sensitive.read": "global-or-unit",
  "documents.sensitive.manage": "global-or-unit",
  "employment.manage_history": "global-or-unit",
  "occurrences.create": "global-or-unit",
  "occurrences.review.supervisor": "global-or-unit",
  "occurrences.review.final": "global-or-unit",
  "occurrences.manage_types": "global",
  "training.create": "global-or-unit",
  "training.review": "global-or-unit",
  "onboarding.manage_templates": "global",
  "onboarding.manage": "global-or-unit",
  "workflows.manage_substitutions": "global-or-unit",
  "organization.read": "global-or-unit",
  "organization.manage_positions": "global-or-unit",
  "hr_communications.manage": "global",
  "hr_resources.manage": "global",
};

export type PermissionGrant = {
  delegation?: Delegation;
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
