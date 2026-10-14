import { z } from "zod";
import { documentTypeSchema } from "./documents.js";

export const trainingSettingsInputSchema = z.strictObject({
  certificateTypeId: z.uuid().nullable(),
});
export const trainingSettingsSchema = z.object({
  certificateType: documentTypeSchema.nullable(),
  documentTypes: z.array(documentTypeSchema),
});

export const trainingInputSchema = z
  .strictObject({
    title: z.string().trim().min(2).max(180),
    institution: z.string().trim().min(2).max(180),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    hours: z.number().positive().max(999999.99).multipleOf(0.01),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "O fim não pode anteceder o início.",
    path: ["endDate"],
  });
export const trainingTransitionSchema = z
  .strictObject({
    action: z.enum(["validate", "reject", "archive"]),
    version: z.number().int().positive(),
    reason: z.string().trim().min(2).max(2000).optional(),
  })
  .refine((value) => value.action !== "reject" || Boolean(value.reason), {
    message: "Informe a justificativa da rejeição.",
    path: ["reason"],
  });
export const trainingStatusLabels = {
  submitted: "Enviada",
  validated: "Validada",
  rejected: "Rejeitada",
  archived: "Arquivada",
} as const;
export const trainingSchema = z.object({
  certificateId: z.uuid().nullable(),
  hasCertificate: z.boolean(),
  id: z.uuid(),
  title: z.string(),
  institution: z.string(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  hours: z.number(),
  personId: z.uuid(),
  requesterAccountId: z.uuid(),
  requesterName: z.string(),
  status: z.enum(["submitted", "validated", "rejected", "archived"]),
  version: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export const trainingDetailSchema = trainingSchema.extend({
  events: z.array(
    z.object({
      type: z.string(),
      reason: z.string().nullable(),
      actorName: z.string(),
      createdAt: z.date(),
      version: z.number().int(),
    }),
  ),
  actions: z.array(z.enum(["validate", "reject", "archive"])),
});
export type Training = z.infer<typeof trainingSchema>;
export type TrainingSettings = z.infer<typeof trainingSettingsSchema>;
export type TrainingDetail = z.infer<typeof trainingDetailSchema>;
