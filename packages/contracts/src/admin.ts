import { z } from "zod";

export const accountCreateSchema = z.object({
  email: z.email().max(254),
  temporaryPassword: z.string().min(12).max(128),
});

export const adminUserCreateSchema = accountCreateSchema.extend({
  personId: z.uuid(),
});

export const passwordResetSchema = z.object({
  temporaryPassword: z.string().min(12).max(128),
});

export const adminUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  status: z.enum(["active", "disabled"]),
  person: z.object({
    id: z.uuid(),
    displayName: z.string(),
  }),
  employment: z
    .object({
      unitId: z.uuid(),
      unitName: z.string(),
    })
    .nullable(),
});

export type AccountCreate = z.infer<typeof accountCreateSchema>;
export type PasswordReset = z.infer<typeof passwordResetSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
