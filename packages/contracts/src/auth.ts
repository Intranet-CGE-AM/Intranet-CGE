import { z } from "zod";

import { permissionEffectSchema, permissionKeySchema } from "./access.js";

export const loginRequestSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});

export const changePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(12).max(128),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "A nova senha deve ser diferente da senha atual.",
    path: ["newPassword"],
  });

export const effectivePermissionSchema = z.object({
  effect: permissionEffectSchema.optional(),
  key: permissionKeySchema,
  unitId: z.uuid().nullable(),
});

export const authenticatedUserSchema = z.object({
  account: z.object({
    id: z.uuid(),
    email: z.email(),
    mustChangePassword: z.boolean(),
  }),
  person: z.object({
    id: z.uuid(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  employment: z
    .object({
      id: z.uuid(),
      jobTitle: z.string().nullable(),
      unit: z.object({
        id: z.uuid(),
        code: z.string(),
        name: z.string(),
      }),
      category: z.object({
        id: z.uuid(),
        name: z.string(),
      }),
    })
    .nullable(),
  permissions: z.array(effectivePermissionSchema),
});

export const authErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const authSuccessSchema = z.object({
  user: authenticatedUserSchema,
});

export const passwordChangedSchema = z.object({
  reauthenticate: z.literal(true),
});

export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
