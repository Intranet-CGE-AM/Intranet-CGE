import type {
  PermissionGrant,
  PermissionKey,
  PermissionOverride,
  PermissionOverrideInput,
  RoleAssignmentInput,
  RoleInput,
} from "@cge/contracts";
import { permissionAllows, permissionSupportsUnitScope } from "@cge/contracts";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import {
  permissionOverrides,
  roleAssignments,
  rolePermissions,
  roles,
} from "./schema.js";

export class RoleScopeError extends Error {
  readonly code = "ROLE_REQUIRES_GLOBAL_SCOPE";

  constructor() {
    super(
      "Este perfil contém permissões que só podem valer para toda a organização.",
    );
  }
}

export class PermissionScopeError extends Error {
  readonly code = "PERMISSION_REQUIRES_GLOBAL_SCOPE";

  constructor() {
    super("Esta combinação de permissão, efeito e escopo não é válida.");
  }
}

export class PermissionOverrideConflictError extends Error {
  readonly code = "PERMISSION_OVERRIDE_ALREADY_EXISTS";

  constructor() {
    super("Já existe um ajuste individual para esta permissão e escopo.");
  }
}

export class AccessService {
  constructor(private readonly db: Database) {}

  async resolvePermissions(accountId: string): Promise<PermissionGrant[]> {
    const [roleGrants, overrides] = await Promise.all([
      this.db
        .select({
          key: rolePermissions.permission,
          unitId: roleAssignments.unitId,
        })
        .from(roleAssignments)
        .innerJoin(
          rolePermissions,
          eq(roleAssignments.roleId, rolePermissions.roleId),
        )
        .where(eq(roleAssignments.accountId, accountId)),
      this.db
        .select({
          effect: permissionOverrides.effect,
          key: permissionOverrides.permission,
          unitId: permissionOverrides.unitId,
        })
        .from(permissionOverrides)
        .where(eq(permissionOverrides.accountId, accountId)),
    ]);

    return [
      ...(roleGrants as PermissionGrant[])
        .filter(
          (grant) =>
            grant.unitId === null || permissionSupportsUnitScope(grant.key),
        )
        .map((grant) => ({ ...grant, effect: "allow" as const })),
      ...(overrides as PermissionGrant[]),
    ];
  }

  async allows(accountId: string, permission: PermissionKey, unitId?: string) {
    return permissionAllows(
      await this.resolvePermissions(accountId),
      permission,
      unitId,
    );
  }

  async listRoles() {
    const roleRows = await this.db.select().from(roles).orderBy(roles.name);
    const permissionRows = roleRows.length
      ? await this.db
          .select()
          .from(rolePermissions)
          .where(
            inArray(
              rolePermissions.roleId,
              roleRows.map((role) => role.id),
            ),
          )
      : [];

    return roleRows.map((role) => ({
      ...role,
      permissions: permissionRows
        .filter((item) => item.roleId === role.id)
        .map((item) => item.permission as PermissionKey),
    }));
  }

  async createRole(input: RoleInput) {
    return this.db.transaction(async (transaction) => {
      const [role] = await transaction
        .insert(roles)
        .values({
          name: input.name,
          description: input.description ?? null,
        })
        .returning();
      if (!role) {
        throw new Error("Role was not created");
      }
      if (input.permissions.length) {
        await transaction.insert(rolePermissions).values(
          [...new Set(input.permissions)].map((permission) => ({
            permission,
            roleId: role.id,
          })),
        );
      }
      return {
        ...role,
        permissions: [...new Set(input.permissions)],
      };
    });
  }

  async updateRole(id: string, input: RoleInput) {
    return this.db.transaction(async (transaction) => {
      if (
        input.permissions.some(
          (permission) => !permissionSupportsUnitScope(permission),
        )
      ) {
        const [scopedAssignment] = await transaction
          .select({ id: roleAssignments.id })
          .from(roleAssignments)
          .where(
            and(
              eq(roleAssignments.roleId, id),
              isNotNull(roleAssignments.unitId),
            ),
          )
          .limit(1);
        if (scopedAssignment) {
          throw new RoleScopeError();
        }
      }
      const [role] = await transaction
        .update(roles)
        .set({
          name: input.name,
          description: input.description ?? null,
        })
        .where(eq(roles.id, id))
        .returning();
      if (!role) {
        return null;
      }
      await transaction
        .delete(rolePermissions)
        .where(eq(rolePermissions.roleId, id));
      if (input.permissions.length) {
        await transaction.insert(rolePermissions).values(
          [...new Set(input.permissions)].map((permission) => ({
            permission,
            roleId: id,
          })),
        );
      }
      return {
        ...role,
        permissions: [...new Set(input.permissions)],
      };
    });
  }

  async createAssignment(input: RoleAssignmentInput) {
    if (input.unitId) {
      const permissions = await this.db
        .select({ permission: rolePermissions.permission })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, input.roleId));
      if (
        permissions.some(
          ({ permission }) =>
            !permissionSupportsUnitScope(permission as PermissionKey),
        )
      ) {
        throw new RoleScopeError();
      }
    }
    const [assignment] = await this.db
      .insert(roleAssignments)
      .values(input)
      .returning();
    if (!assignment) {
      throw new Error("Role assignment was not created");
    }
    return assignment;
  }

  listAssignments(accountId?: string) {
    return this.db
      .select()
      .from(roleAssignments)
      .where(accountId ? eq(roleAssignments.accountId, accountId) : undefined);
  }

  async deleteAssignment(id: string) {
    const [assignment] = await this.db
      .delete(roleAssignments)
      .where(eq(roleAssignments.id, id))
      .returning();
    return assignment ?? null;
  }

  async listOverrides(accountId?: string): Promise<PermissionOverride[]> {
    const rows = await this.db
      .select()
      .from(permissionOverrides)
      .where(
        accountId ? eq(permissionOverrides.accountId, accountId) : undefined,
      );
    return rows as PermissionOverride[];
  }

  async createOverride(input: PermissionOverrideInput) {
    if (
      input.unitId &&
      (input.effect === "deny" ||
        !permissionSupportsUnitScope(input.permission))
    ) {
      throw new PermissionScopeError();
    }
    const [existing] = await this.db
      .select({ id: permissionOverrides.id })
      .from(permissionOverrides)
      .where(
        and(
          eq(permissionOverrides.accountId, input.accountId),
          eq(permissionOverrides.permission, input.permission),
          input.unitId
            ? eq(permissionOverrides.unitId, input.unitId)
            : isNull(permissionOverrides.unitId),
        ),
      )
      .limit(1);
    if (existing) throw new PermissionOverrideConflictError();
    const [override] = await this.db
      .insert(permissionOverrides)
      .values(input)
      .returning();
    if (!override) {
      throw new Error("Permission override was not created");
    }
    return override as PermissionOverride;
  }

  async deleteOverride(id: string) {
    const [override] = await this.db
      .delete(permissionOverrides)
      .where(eq(permissionOverrides.id, id))
      .returning();
    return (override as PermissionOverride | undefined) ?? null;
  }
}
