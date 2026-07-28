import type {
  PermissionKey,
  RoleAssignmentInput,
  RoleInput,
} from "@cge/contracts";
import { eq, inArray } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { roleAssignments, rolePermissions, roles } from "./schema.js";

export type PermissionGrant = {
  key: PermissionKey;
  unitId: string | null;
};

export function permissionAllows(
  grants: PermissionGrant[],
  permission: PermissionKey,
  unitId?: string,
) {
  return grants.some(
    (grant) =>
      grant.key === permission &&
      (grant.unitId === null || grant.unitId === unitId),
  );
}

export class AccessService {
  constructor(private readonly db: Database) {}

  async resolvePermissions(accountId: string): Promise<PermissionGrant[]> {
    const grants = await this.db
      .select({
        key: rolePermissions.permission,
        unitId: roleAssignments.unitId,
      })
      .from(roleAssignments)
      .innerJoin(
        rolePermissions,
        eq(roleAssignments.roleId, rolePermissions.roleId),
      )
      .where(eq(roleAssignments.accountId, accountId));

    return grants as PermissionGrant[];
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
}
