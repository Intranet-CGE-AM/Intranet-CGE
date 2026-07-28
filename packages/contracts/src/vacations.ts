import { z } from "zod";

export const vacationStatusSchema = z.enum([
  "draft",
  "submitted",
  "supervisor_approved",
  "supervisor_rejected",
  "final_approved",
  "final_rejected",
  "cancelled",
]);

export const vacationRequestInputSchema = z
  .object({
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    submit: z.boolean().default(true),
  })
  .refine((value) => value.endDate >= value.startDate, {
    path: ["endDate"],
    message: "A data final deve ser igual ou posterior à data inicial.",
  });

export const vacationVersionInputSchema = z.object({
  version: z.number().int().positive(),
});

export const vacationDecisionInputSchema = vacationVersionInputSchema.extend({
  decision: z.enum(["approve", "reject"]),
  comment: z.string().trim().min(2).max(2_000).nullable().optional(),
});

export const vacationEventSchema = z.object({
  id: z.uuid(),
  type: z.string(),
  actorAccountId: z.uuid(),
  comment: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.date(),
});

export const vacationRequestSchema = z.object({
  id: z.uuid(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  status: vacationStatusSchema,
  version: z.number().int().positive(),
  requester: z.object({
    personId: z.uuid(),
    displayName: z.string(),
    unitId: z.uuid(),
    unitName: z.string(),
  }),
  events: z.array(vacationEventSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type VacationRequestInput = z.infer<typeof vacationRequestInputSchema>;
export type VacationDecisionInput = z.infer<typeof vacationDecisionInputSchema>;
export type VacationRequest = z.infer<typeof vacationRequestSchema>;
