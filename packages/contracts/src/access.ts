import { z } from "zod";

export const permissionKeys = [
  "access.manage",
  "audit.read",
  "audit.export",
  "people.read",
  "people.manage",
  "people.import",
  "birthdays.read",
  "vacations.create",
  "vacations.review.supervisor",
  "vacations.review.final",
] as const;

export const permissionKeySchema = z.enum(permissionKeys);

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

export type PermissionKey = z.infer<typeof permissionKeySchema>;
export type RoleInput = z.infer<typeof roleInputSchema>;
export type RoleAssignmentInput = z.infer<typeof roleAssignmentInputSchema>;
