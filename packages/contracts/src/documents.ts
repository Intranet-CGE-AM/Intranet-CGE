import { z } from "zod";
export const documentTypeInputSchema = z.strictObject({
  name: z.string().trim().min(2).max(120),
  purpose: z.string().trim().min(10).max(500),
  policyReference: z.string().trim().min(5).max(240),
  retentionDays: z.number().int().min(1).max(36500),
  sensitive: z.boolean(),
});
export const documentTypeSchema = documentTypeInputSchema.extend({
  id: z.uuid(),
});
export const documentInputSchema = z
  .strictObject({
    personId: z.uuid(),
    typeId: z.uuid(),
    title: z.string().trim().min(2).max(180),
    issuedOn: z.iso.date(),
    validUntil: z.iso.date().nullable().optional(),
    source: z.string().trim().min(2).max(180),
    requiresAcknowledgment: z.boolean().default(false),
    occurrenceId: z.uuid().optional(),
    occurrenceVersion: z.number().int().positive().optional(),
  })
  .refine((value) => !value.validUntil || value.validUntil >= value.issuedOn, {
    path: ["validUntil"],
    message: "A vigência não pode terminar antes da emissão.",
  })
  .refine(
    (value) => Boolean(value.occurrenceId) === Boolean(value.occurrenceVersion),
    {
      message: "Informe a ocorrência e sua versão para anexar o comprovante.",
    },
  );
export const documentSchema = z.object({
  id: z.uuid(),
  personId: z.uuid(),
  typeId: z.uuid(),
  typeName: z.string(),
  title: z.string(),
  issuedOn: z.iso.date(),
  validUntil: z.iso.date().nullable(),
  source: z.string(),
  purpose: z.string(),
  policyReference: z.string(),
  retentionDays: z.number().int(),
  retainedUntil: z.date(),
  sensitive: z.boolean(),
  size: z.number().int(),
  authorName: z.string(),
  requiresAcknowledgment: z.boolean(),
  acknowledgedAt: z.date().nullable(),
  acknowledgedByAccountId: z.uuid().nullable(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
});
export type FunctionalDocument = z.infer<typeof documentSchema>;
export type DocumentType = z.infer<typeof documentTypeSchema>;
