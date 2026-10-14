import { z } from "zod";

import { permissionEffectSchema, permissionKeySchema } from "./access.js";
import { delegationSchema } from "./substitutions.js";

export const loginRequestSchema = z
  .object({
    identifier: z.string().trim().min(1).max(254).optional(),
    email: z.email().max(254).optional(),
    password: z.string().min(1).max(128),
  })
  .refine((value) => Boolean(value.identifier) !== Boolean(value.email), {
    message: "Informe um único identificador de acesso.",
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
  delegation: delegationSchema.optional(),
  effect: permissionEffectSchema.optional(),
  key: permissionKeySchema,
  unitId: z.uuid().nullable(),
});

export const authenticatedUserSchema = z.object({
  account: z.object({
    id: z.uuid(),
    email: z.email().nullable(),
    authProvider: z.enum(["local", "ad"]),
    directoryUsername: z.string().nullable(),
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
