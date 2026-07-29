import { z } from "zod";

export const auditOutcomeSchema = z.enum(["success", "failure", "denied"]);

export const auditEventSchema = z.object({
  id: z.uuid(),
  action: z.string(),
  actor: z
    .object({
      accountId: z.uuid(),
      email: z.email(),
      displayName: z.string(),
    })
    .nullable(),
  objectType: z.string(),
  objectId: z.uuid().nullable(),
  outcome: auditOutcomeSchema,
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.iso.datetime(),
});

export const auditPageSchema = z.object({
  events: z.array(auditEventSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;
export type AuditOutcome = z.infer<typeof auditOutcomeSchema>;
export type AuditPage = z.infer<typeof auditPageSchema>;
