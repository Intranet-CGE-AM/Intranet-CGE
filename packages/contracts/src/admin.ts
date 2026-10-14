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
  email: z.email().nullable(),
  authProvider: z.enum(["local", "ad"]),
  directoryUsername: z.string().nullable(),
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

export const accountCandidateSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  unitId: z.uuid().nullable(),
  unitName: z.string().nullable(),
});

export type AccountCreate = z.infer<typeof accountCreateSchema>;
export type AccountCandidate = z.infer<typeof accountCandidateSchema>;
export type PasswordReset = z.infer<typeof passwordResetSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;

export const directoryLookupSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
});
export const directoryPreviewSchema = z.object({
  guid: z.uuid(),
  upn: z.string(),
  samAccountName: z.string(),
  displayName: z.string(),
  email: z.email().nullable(),
  eligible: z.boolean(),
});
export const directoryLinkSchema = directoryLookupSchema.extend({
  personId: z.uuid(),
  expectedGuid: z.uuid(),
});
export type DirectoryPreview = z.infer<typeof directoryPreviewSchema>;
export type DirectoryLink = z.infer<typeof directoryLinkSchema>;
