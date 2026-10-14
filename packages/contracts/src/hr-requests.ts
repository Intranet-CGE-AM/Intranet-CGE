import { z } from "zod";
import { personUpdateSchema, personInputSchema } from "./people.js";

export const correctionInputSchema = personUpdateSchema
  .pick({
    fullName: true,
    preferredName: true,
    birthDate: true,
  })
  .extend({
    employment: personInputSchema.shape.employment
      .pick({
        jobTitle: true,
        categoryId: true,
        unitId: true,
        supervisorRelationshipId: true,
      })
      .partial()
      .strict()
      .optional(),
  })
  .strict();
export const correctionSnapshotSchema = z.object({
  previous: correctionInputSchema,
  proposed: correctionInputSchema,
  employmentVersion: z.number().int().positive(),
  display: z
    .record(
      z.string(),
      z.object({ previous: z.string(), proposed: z.string() }),
    )
    .default({}),
});
export type CorrectionSnapshot = z.infer<typeof correctionSnapshotSchema>;

export const hrRequestTypes = {
  correction: "Correção cadastral",
  declaration: "Declaração funcional",
  vacation_question: "Dúvida sobre férias",
  other: "Outra demanda",
} as const;
export const hrRequestTypeSchema = z.enum([
  "correction",
  "declaration",
  "vacation_question",
  "other",
]);
export const hrRequestStatusSchema = z.enum([
  "submitted",
  "in_analysis",
  "completed",
  "rejected",
  "cancelled",
]);
export const hrRequestInputSchema = z
  .strictObject({
    type: hrRequestTypeSchema,
    description: z.string().trim().min(10).max(2000),
    correction: correctionInputSchema.optional(),
  })
  .refine(
    (value) =>
      value.type === "correction"
        ? Boolean(value.correction)
        : !value.correction,
    {
      path: ["correction"],
      message: "Informe os campos da correção somente para correção cadastral.",
    },
  );
export const hrRequestTransitionSchema = z
  .strictObject({
    action: z.enum([
      "start",
      "complete",
      "reject",
      "cancel",
      "request_information",
      "provide_information",
    ]),
    version: z.number().int().positive(),
    message: z.string().trim().min(2).max(2000).optional(),
    deadline: z.iso.date().optional(),
  })
  .refine(
    (value) =>
      ![
        "complete",
        "reject",
        "request_information",
        "provide_information",
      ].includes(value.action) || Boolean(value.message),
    {
      path: ["message"],
      message: "Informe uma resposta para concluir ou rejeitar.",
    },
  )
  .refine(
    (value) =>
      value.action !== "request_information" || Boolean(value.deadline),
    {
      path: ["deadline"],
      message: "Informe o prazo para envio do complemento.",
    },
  );
export const hrRequestSchema = z.object({
  id: z.uuid(),
  protocol: z.string(),
  type: hrRequestTypeSchema,
  description: z.string(),
  correction: correctionSnapshotSchema.nullable(),
  status: hrRequestStatusSchema,
  version: z.number().int(),
  requesterAccountId: z.uuid(),
  requesterName: z.string(),
  employmentId: z.uuid(),
  unitId: z.uuid(),
  assigneeAccountId: z.uuid().nullable(),
  response: z.string().nullable(),
  informationMessage: z.string().nullable(),
  informationDeadline: z.iso.date().nullable(),
  dueAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export const hrRequestEventSchema = z.object({
  id: z.uuid(),
  requestId: z.uuid(),
  version: z.number().int(),
  actorAccountId: z.uuid(),
  actorName: z.string(),
  type: z.string(),
  message: z.string().nullable(),
  createdAt: z.date(),
});
export const hrRequestDetailSchema = hrRequestSchema.extend({
  events: z.array(hrRequestEventSchema),
});
export type HrRequest = z.infer<typeof hrRequestSchema>;
export type HrRequestDetail = z.infer<typeof hrRequestDetailSchema>;
