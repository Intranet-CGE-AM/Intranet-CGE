import { z } from "zod";

export const occurrenceTypeInputSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(120),
    active: z.boolean(),
    requiresSupervisor: z.boolean(),
    requiresRH: z.boolean(),
    requiresDocument: z.boolean(),
    affectsAvailability: z.boolean(),
    documentTypeId: z.uuid().nullable(),
  })
  .refine((value) => !value.requiresDocument || value.documentTypeId !== null, {
    message: "Defina a política documental antes de exigir comprovante.",
  });

export const occurrenceInputSchema = z
  .strictObject({
    typeId: z.uuid(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    justification: z.string().trim().min(10).max(2000),
    documentId: z.uuid().nullable().optional(),
    submit: z.boolean().default(true),
  })
  .refine((value) => value.endDate >= value.startDate, {
    path: ["endDate"],
    message: "A data final não pode anteceder a inicial.",
  });

export const occurrenceStatuses = {
  draft: "Rascunho",
  submitted: "Enviada",
  supervisor_approved: "Aprovada pela chefia",
  final_approved: "Aprovada",
  rejected: "Rejeitada",
  cancelled: "Cancelada",
} as const;

export type OccurrenceTypeInput = z.infer<typeof occurrenceTypeInputSchema>;

export const occurrenceTransitionSchema = z
  .strictObject({
    action: z.enum(["submit", "approve", "reject", "cancel"]),
    version: z.number().int().positive(),
    comment: z.string().trim().min(2).max(2000).optional(),
  })
  .refine((value) => value.action !== "reject" || Boolean(value.comment), {
    path: ["comment"],
    message: "Informe o motivo da rejeição.",
  });

export const occurrenceTypeSchema = occurrenceTypeInputSchema.safeExtend({
  id: z.uuid(),
});
export const occurrenceSchema = z.object({
  id: z.uuid(),
  typeName: z.string(),
  requesterName: z.string(),
  requesterAccountId: z.uuid(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  status: z.enum(
    Object.keys(occurrenceStatuses) as [
      keyof typeof occurrenceStatuses,
      ...(keyof typeof occurrenceStatuses)[],
    ],
  ),
  version: z.number().int(),
  affectsAvailability: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  justification: z.string().optional(),
  documentId: z.uuid().nullable().optional(),
  requiresDocument: z.boolean().optional(),
  documentTypeId: z.uuid().nullable().optional(),
});
export const occurrenceDetailSchema = occurrenceSchema.extend({
  actions: z.array(z.enum(["submit", "approve", "reject", "cancel"])),
  events: z.array(
    z.object({
      type: z.string(),
      actorAccountId: z.uuid(),
      actorName: z.string(),
      version: z.number().int(),
      createdAt: z.date(),
      comment: z.string().nullable().optional(),
    }),
  ),
});
export type Occurrence = z.infer<typeof occurrenceSchema>;
export type OccurrenceDetail = z.infer<typeof occurrenceDetailSchema>;
export type OccurrenceType = z.infer<typeof occurrenceTypeSchema>;
