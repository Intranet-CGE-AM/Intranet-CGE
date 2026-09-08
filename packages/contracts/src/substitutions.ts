import { z } from "zod";

export const substitutionFlowSchema = z.enum([
  "vacations.review.supervisor",
  "vacations.review.final",
  "hr_requests.manage",
  "occurrences.review.supervisor",
  "occurrences.review.final",
  "training.review",
  "onboarding.manage",
  "checklist.assignment",
]);
export const substitutionInputSchema = z
  .strictObject({
    originalAccountId: z.uuid(),
    substituteAccountId: z.uuid(),
    unitId: z.uuid(),
    startsOn: z.iso.date(),
    endsOn: z.iso.date(),
    reason: z.string().trim().min(10).max(2000),
    flows: z
      .array(substitutionFlowSchema)
      .min(1)
      .max(8)
      .refine(
        (values) => new Set(values).size === values.length,
        "Selecione cada fluxo uma única vez.",
      ),
  })
  .refine((value) => value.originalAccountId !== value.substituteAccountId, {
    message: "Escolha outra pessoa para substituir.",
  })
  .refine((value) => value.endsOn >= value.startsOn, {
    message: "O término deve ser igual ou posterior ao início.",
  });
export const substitutionSchema = z.object({
  ...substitutionInputSchema.shape,
  id: z.uuid(),
  version: z.number().int().positive(),
  cancelledAt: z.date().nullable(),
  createdAt: z.date(),
});
export const substitutionUpdateInputSchema = substitutionInputSchema.safeExtend(
  { version: z.number().int().positive() },
);
export const delegationSchema = z.object({
  id: z.uuid(),
  originalAccountId: z.uuid(),
  originalPersonId: z.uuid(),
  originalName: z.string(),
});
export type Delegation = z.infer<typeof delegationSchema>;
export type SubstitutionInput = z.infer<typeof substitutionInputSchema>;
export type Substitution = z.infer<typeof substitutionSchema> & {
  originalName: string;
  substituteName: string;
  unitName: string;
};
export type SubstitutionList = {
  substitutions: Substitution[];
  hasMore: boolean;
  units: { id: string; name: string; active: boolean }[];
};
