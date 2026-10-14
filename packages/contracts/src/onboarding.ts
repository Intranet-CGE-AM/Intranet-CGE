import { z } from "zod";

const templateItemSchema = z.strictObject({
  title: z.string().trim().min(2).max(180),
  area: z.string().trim().min(2).max(120),
  required: z.boolean(),
  active: z.boolean(),
});
export const onboardingTemplateInputSchema = z.strictObject({
  name: z.string().trim().min(2).max(180),
  kind: z.enum(["entry", "exit"]),
  active: z.boolean(),
  items: z.array(templateItemSchema).min(1).max(100),
});
export const onboardingTemplateSchema = onboardingTemplateInputSchema.extend({
  id: z.uuid(),
  version: z.number().int().positive(),
});
export const checklistInputSchema = z.strictObject({
  personId: z.uuid(),
  employmentId: z.uuid(),
  templateId: z.uuid(),
  assignments: z
    .array(
      z.strictObject({
        itemIndex: z.number().int().min(0).max(99),
        accountId: z.uuid(),
      }),
    )
    .min(1)
    .max(100),
});
export const checklistItemSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  area: z.string(),
  required: z.boolean(),
  assigneeAccountId: z.uuid(),
  assigneeName: z.string(),
  status: z.enum(["pending", "completed", "waived"]),
  completedBy: z.uuid().nullable(),
  completedAt: z.iso.datetime().nullable(),
  comment: z.string().nullable(),
});
export const checklistSchema = z.object({
  id: z.uuid(),
  personId: z.uuid(),
  personName: z.string(),
  employmentId: z.uuid(),
  templateId: z.uuid(),
  name: z.string(),
  kind: z.enum(["entry", "exit"]),
  unitId: z.uuid(),
  version: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
  items: z.array(checklistItemSchema.extend({ canAct: z.boolean() })),
  progress: z.object({
    completed: z.number().int(),
    waived: z.number().int(),
    pending: z.number().int(),
    total: z.number().int(),
  }),
});
export const checklistItemActionSchema = z.strictObject({
  action: z.enum(["complete", "waive"]),
  version: z.number().int().positive(),
  comment: z.string().trim().min(2).max(2000).optional(),
});
export type OnboardingTemplate = z.infer<typeof onboardingTemplateSchema>;
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
export type Checklist = z.infer<typeof checklistSchema>;
