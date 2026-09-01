import { z } from "zod";

/* =========================================================
 * STATUS DA VISITA
 * ======================================================= */

export const visitStatusSchema = z.enum([
  "pending",
  "approved",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
  "rejected",
]);

/* =========================================================
 * TIPOS DE VISITA
 * ======================================================= */

export const visitTypeSchema = z.enum([
  "institutional_meeting",
  "technical_support",
  "technical_visit",
  "alignment_meeting",
  "presentation",
  "audit",
  "inspection",
  "training",
  "external_service",
  "other",
]);

/* =========================================================
 * LOCAIS
 * ======================================================= */

export const visitLocationSchema = z.enum([
  "Sala de Reuniões - Anexo",
  "Sala de Reuniões - Sede",
  "Auditório",
]);

/* =========================================================
 * CONFIRMAÇÃO DO VISITANTE
 * ======================================================= */

export const visitorConfirmationStatusSchema = z.enum([
  "not_sent",
  "pending",
  "confirmed",
  "declined",
  "expired",
]);

/* =========================================================
 * INPUT DO VISITANTE
 * ======================================================= */

export const visitorInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(160),

  position: z
    .string()
    .trim()
    .max(120)
    .nullable()
    .optional(),

  organization: z
    .string()
    .trim()
    .min(2)
    .max(160),

  sector: z
    .string()
    .trim()
    .max(160)
    .nullable()
    .optional(),

  email: z
    .string()
    .email()
    .nullable()
    .optional(),

  phone: z
    .string()
    .trim()
    .max(30)
    .nullable()
    .optional(),

  cpf: z
    .string()
    .trim()
    .max(14)
    .nullable()
    .optional(),
});

/* =========================================================
 * SCHEMA BASE DA VISITA
 *
 * IMPORTANTE:
 * sem refine aqui para permitir .partial() no UPDATE.
 * ======================================================= */

const visitBaseSchema = z.object({
  type: visitTypeSchema,

  subject: z
    .string()
    .trim()
    .min(3)
    .max(240),

  description: z
    .string()
    .trim()
    .max(4000)
    .nullable()
    .optional(),

  organization: z
    .string()
    .trim()
    .min(2)
    .max(160),

  sector: z
    .string()
    .trim()
    .max(160)
    .nullable()
    .optional(),

  scheduledDate: z
    .string()
    .date(),

  startTime: z
    .string()
    .regex(
      /^([01]\d|2[0-3]):[0-5]\d$/,
      "Horário inicial inválido.",
    ),

  endTime: z
    .string()
    .regex(
      /^([01]\d|2[0-3]):[0-5]\d$/,
      "Horário final inválido.",
    ),

  location: visitLocationSchema,

  responsibleUnitId: z
    .string()
    .uuid()
    .nullable()
    .optional(),

  responsibleAccountId: z
    .string()
    .uuid()
    .nullable()
    .optional(),

  visitors: z
    .array(visitorInputSchema)
    .min(1)
    .max(50),
});

/* =========================================================
 * CREATE
 * ======================================================= */

export const visitInputSchema =
  visitBaseSchema.refine(
    (value) =>
      value.endTime >
      value.startTime,
    {
      path: ["endTime"],

      message:
        "O horário final deve ser posterior ao horário inicial.",
    },
  );

/* =========================================================
 * UPDATE
 * ======================================================= */

export const visitUpdateInputSchema =
  visitBaseSchema
    .partial()
    .superRefine(
      (
        value,
        context,
      ) => {
        if (
          value.startTime !== undefined &&
          value.endTime !== undefined &&
          value.endTime <= value.startTime
        ) {
          context.addIssue({
            code: "custom",

            path: ["endTime"],

            message:
              "O horário final deve ser posterior ao horário inicial.",
          });
        }
      },
    );

/* =========================================================
 * LISTAGEM
 * ======================================================= */

export const visitListQuerySchema = z.object({
  query: z
    .string()
    .trim()
    .optional(),

  status:
    visitStatusSchema.optional(),

  type:
    visitTypeSchema.optional(),

  location:
    visitLocationSchema.optional(),

  organization: z
    .string()
    .trim()
    .optional(),

  subject: z
    .string()
    .trim()
    .optional(),

  dateFrom: z
    .string()
    .date()
    .optional(),

  dateTo: z
    .string()
    .date()
    .optional(),

  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1),

  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10),
});

/* =========================================================
 * VISITANTE PERSISTIDO
 * ======================================================= */

export const visitorSchema =
  visitorInputSchema.extend({
    id:
      z.string().uuid(),

    visitId:
      z.string().uuid(),

    confirmationStatus:
      visitorConfirmationStatusSchema,

    /*
     * Nunca será necessário exibir o hash no frontend.
     * Mantenho no contrato como opcional apenas caso
     * alguma resposta interna do service o contenha.
     */
    confirmationTokenHash: z
      .string()
      .nullable()
      .optional(),

    confirmationSentAt: z
      .date()
      .nullable()
      .optional(),

    confirmationRespondedAt: z
      .date()
      .nullable()
      .optional(),

    confirmationExpiresAt: z
      .date()
      .nullable()
      .optional(),
  });

/* =========================================================
 * EVENTO
 * ======================================================= */

export const visitEventSchema = z.object({
  id:
    z.string().uuid(),

  visitId:
    z.string().uuid(),

  actorAccountId:
    z.string().uuid(),

  type:
    z.string(),

  comment:
    z.string().nullable(),

  createdAt:
    z.date(),
});

/* =========================================================
 * VISITA COMPLETA
 * ======================================================= */

export const visitSchema = z.object({
  id:
    z.string().uuid(),

  protocol:
    z.string(),

  type:
    visitTypeSchema,

  subject:
    z.string(),

  description:
    z.string().nullable(),

  organization:
    z.string(),

  sector:
    z.string().nullable(),

  scheduledDate:
    z.string().date(),

  startTime:
    z.string(),

  endTime:
    z.string(),

  location:
    visitLocationSchema,

  responsibleUnitId: z
    .string()
    .uuid()
    .nullable(),

  responsibleAccountId: z
    .string()
    .uuid()
    .nullable(),

  status:
    visitStatusSchema,

  visitors:
    z.array(visitorSchema),

  events:
    z.array(visitEventSchema),

  createdAt:
    z.date(),

  updatedAt:
    z.date(),
});

/* =========================================================
 * RESUMO
 * ======================================================= */

export const visitSummarySchema = z.object({
  id:
    z.string().uuid(),

  protocol:
    z.string(),

  type:
    visitTypeSchema,

  subject:
    z.string(),

  organization:
    z.string(),

  sector:
    z.string().nullable(),

  scheduledDate:
    z.string(),

  startTime:
    z.string(),

  endTime:
    z.string(),

  location:
    visitLocationSchema,

  status:
    visitStatusSchema,
});

/* =========================================================
 * PAGINAÇÃO
 * ======================================================= */

export const visitPageResultSchema = z.object({
  visits:
    z.array(visitSummarySchema),

  pagination: z.object({
    page:
      z.number(),

    pageSize:
      z.number(),

    total:
      z.number(),

    totalPages:
      z.number(),
  }),
});

/* =========================================================
 * DASHBOARD
 * ======================================================= */

export const visitDashboardSchema = z.object({
  counters: z.object({
    today:
      z.number(),

    tomorrow:
      z.number(),

    month:
      z.number(),

    pending:
      z.number(),

    inProgress:
      z.number(),

    completed:
      z.number(),
  }),

  today:
    z.array(visitSummarySchema),

  tomorrow:
    z.array(visitSummarySchema),

  upcoming:
    z.array(visitSummarySchema),

  recentTechnicalVisits:
    z.array(visitSummarySchema),
});

/* =========================================================
 * DECISÃO
 * ======================================================= */

export const visitDecisionInputSchema = z.object({
  decision: z.enum([
    "approve",
    "reject",
  ]),

  comment: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional(),
});

/* =========================================================
 * ALTERAÇÃO DE STATUS
 * ======================================================= */

export const visitStatusInputSchema = z.object({
  status: z.enum([
    "scheduled",
    "in_progress",
    "completed",
    "cancelled",
  ]),

  comment: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional(),
});

/* =========================================================
 * CONFIRMAÇÃO EXTERNA
 * ======================================================= */

export const visitorConfirmationResponseSchema =
  z.object({
    response: z.enum([
      "confirmed",
      "declined",
    ]),
  });

export const publicVisitConfirmationSchema =
  z.object({
    visitorName:
      z.string(),

    organization:
      z.string(),

    protocol:
      z.string(),

    subject:
      z.string(),

    scheduledDate:
      z.string(),

    startTime:
      z.string(),

    endTime:
      z.string(),

    location:
      z.string(),

    status:
      visitorConfirmationStatusSchema,
  });

/* =========================================================
 * TYPES
 * ======================================================= */

export type VisitStatus =
  z.infer<
    typeof visitStatusSchema
  >;

export type VisitType =
  z.infer<
    typeof visitTypeSchema
  >;

export type VisitLocation =
  z.infer<
    typeof visitLocationSchema
  >;

export type VisitorConfirmationStatus =
  z.infer<
    typeof visitorConfirmationStatusSchema
  >;

export type VisitorInput =
  z.infer<
    typeof visitorInputSchema
  >;

export type VisitInput =
  z.infer<
    typeof visitInputSchema
  >;

export type VisitUpdateInput =
  z.infer<
    typeof visitUpdateInputSchema
  >;

export type VisitListQuery =
  z.infer<
    typeof visitListQuerySchema
  >;

export type VisitPageResult =
  z.infer<
    typeof visitPageResultSchema
  >;

export type VisitDecisionInput =
  z.infer<
    typeof visitDecisionInputSchema
  >;

export type VisitStatusInput =
  z.infer<
    typeof visitStatusInputSchema
  >;

export type Visitor =
  z.infer<
    typeof visitorSchema
  >;

export type VisitEvent =
  z.infer<
    typeof visitEventSchema
  >;

export type Visit =
  z.infer<
    typeof visitSchema
  >;

export type VisitSummary =
  z.infer<
    typeof visitSummarySchema
  >;

export type VisitDashboard =
  z.infer<
    typeof visitDashboardSchema
  >;

export type VisitorConfirmationResponse =
  z.infer<
    typeof visitorConfirmationResponseSchema
  >;

export type PublicVisitConfirmation =
  z.infer<
    typeof publicVisitConfirmationSchema
  >;