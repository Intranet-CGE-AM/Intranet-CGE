import { z } from "zod";

export const ticketStatusKeys = [
  "open",
  "viewed",
  "en_route",
  "in_service",
  "completed",
  "cancelled",
  "paused",
  "maintenance",
] as const;

export const ticketStatusSchema = z.enum(ticketStatusKeys);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const ticketPriorityKeys = ["low", "medium", "high", "urgent"] as const;
export const ticketPrioritySchema = z.enum(ticketPriorityKeys);
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;

export const ticketApprovalStatusKeys = [
  "not_required",
  "pending",
  "approved",
  "rejected",
] as const;
export const ticketApprovalStatusSchema = z.enum(ticketApprovalStatusKeys);
export type TicketApprovalStatus = z.infer<typeof ticketApprovalStatusSchema>;

export const technicalAreaKeys = ["sistemas", "redes", "manutencao"] as const;
export const technicalAreaSchema = z.enum(technicalAreaKeys);
export type TechnicalArea = z.infer<typeof technicalAreaSchema>;

// Subcategoria
export const ticketSubcategorySchema = z.object({
  id: z.uuid(),
  categoryId: z.uuid(),
  name: z.string(),
  code: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  slaHours: z.number().int().nullable().optional(),
  n1Tips: z.string().nullable().optional(),
  defaultPriority: ticketPrioritySchema.default("medium"),
  areaResponsavel: technicalAreaSchema.nullable().optional(),
  requiresApproval: z.boolean().default(false),
  dualApproval: z.boolean().default(false),
  requiresPresential: z.boolean().default(true),
  requiresCauseSolution: z.boolean().default(true),
  allowsFreeText: z.boolean().default(false),
  freeTextLabel: z.string().nullable().optional(),
  formType: z.string().nullable().optional(),
  active: z.boolean().default(true),
});
export type TicketSubcategory = z.infer<typeof ticketSubcategorySchema>;

// Categoria
export const ticketCategorySchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  allowsFreeText: z.boolean().default(false),
  allowsBeneficiary: z.boolean().default(true),
  n1Tips: z.string().nullable().optional(),
  slaHours: z.number().int().nullable().optional(),
  defaultPriority: ticketPrioritySchema.default("medium"),
  active: z.boolean().default(true),
  subcategories: z.array(ticketSubcategorySchema).default([]),
});
export type TicketCategory = z.infer<typeof ticketCategorySchema>;

// Input para criação de chamado
export const ticketCreateInputSchema = z.object({
  categoryId: z.uuid(),
  subcategoryId: z.uuid().nullable().optional(),
  freeTextDescription: z.string().trim().max(3000).nullable().optional(),
  anyDeskCode: z.string().trim().max(30).nullable().optional(),
  extraData: z.record(z.string(), z.unknown()).nullable().optional(),
  unitId: z.uuid().nullable().optional(),
  // Beneficiário opcional (quando aberto para outra pessoa)
  beneficiaryName: z.string().trim().min(2).max(180).nullable().optional(),
  beneficiaryEmployeeNumber: z.string().trim().max(50).nullable().optional(),
  beneficiaryEmail: z.string().trim().email().nullable().optional(),
  beneficiaryDept: z.string().trim().max(160).nullable().optional(),
});
export type TicketCreateInput = z.infer<typeof ticketCreateInputSchema>;

// Mensagem / Chat
export const ticketMessageSchema = z.object({
  id: z.uuid(),
  ticketId: z.uuid(),
  authorAccountId: z.uuid().nullable(),
  authorName: z.string(),
  fromUser: z.boolean(),
  content: z.string(),
  createdAt: z.string(),
});
export type TicketMessage = z.infer<typeof ticketMessageSchema>;

export const ticketMessageInputSchema = z.object({
  content: z.string().trim().min(1, "A mensagem não pode ser vazia.").max(3000),
});
export type TicketMessageInput = z.infer<typeof ticketMessageInputSchema>;

// Evento / Histórico
export const ticketEventSchema = z.object({
  id: z.uuid(),
  ticketId: z.uuid(),
  actorAccountId: z.uuid().nullable(),
  actorName: z.string().nullable().optional(),
  fromStatus: ticketStatusSchema.nullable().optional(),
  toStatus: ticketStatusSchema,
  note: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type TicketEvent = z.infer<typeof ticketEventSchema>;

// Aprovação
export const ticketApprovalSchema = z.object({
  id: z.uuid(),
  ticketId: z.uuid(),
  unitId: z.uuid().nullable(),
  unitName: z.string().nullable().optional(),
  approverAccountId: z.uuid().nullable(),
  approverName: z.string().nullable().optional(),
  isAtecApproval: z.boolean().default(false),
  status: ticketApprovalStatusSchema,
  note: z.string().nullable().optional(),
  decidedAt: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type TicketApproval = z.infer<typeof ticketApprovalSchema>;

// Avaliação de Satisfação
export const ticketFeedbackSchema = z.object({
  id: z.uuid(),
  ticketId: z.uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable().optional(),
  technicianAccountId: z.uuid().nullable().optional(),
  technicianName: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type TicketFeedback = z.infer<typeof ticketFeedbackSchema>;

export const ticketFeedbackInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).nullable().optional(),
});
export type TicketFeedbackInput = z.infer<typeof ticketFeedbackInputSchema>;

// Ações de Transição / Técnico
export const ticketTransitionInputSchema = z.object({
  toStatus: ticketStatusSchema,
  assignedTechAccountId: z.uuid().nullable().optional(),
  unitId: z.uuid().nullable().optional(),
  areaResponsavel: technicalAreaSchema.nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  cause: z.string().trim().max(2000).nullable().optional(),
  solution: z.string().trim().max(2000).nullable().optional(),
  completionNote: z.string().trim().max(2000).nullable().optional(),
});
export type TicketTransitionInput = z.infer<typeof ticketTransitionInputSchema>;

export const ticketAssignInputSchema = z.object({
  assignedTechAccountId: z.uuid().nullable().optional(),
  unitId: z.uuid().nullable().optional(),
  areaResponsavel: technicalAreaSchema.nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});
export type TicketAssignInput = z.infer<typeof ticketAssignInputSchema>;

export const ticketRecategorizeInputSchema = z.object({
  categoryId: z.uuid(),
  subcategoryId: z.uuid().nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});
export type TicketRecategorizeInput = z.infer<
  typeof ticketRecategorizeInputSchema
>;

export const ticketApprovalDecisionInputSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(1000).nullable().optional(),
});
export type TicketApprovalDecisionInput = z.infer<
  typeof ticketApprovalDecisionInputSchema
>;

export const ticketCancelInputSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(2, "Informe a justificativa do cancelamento.")
    .max(1000),
});
export type TicketCancelInput = z.infer<typeof ticketCancelInputSchema>;

export const ticketReopenInputSchema = z.object({
  reason: z.string().trim().min(2, "Informe o motivo da reabertura.").max(1000),
});
export type TicketReopenInput = z.infer<typeof ticketReopenInputSchema>;

export const ticketPauseInputSchema = z.object({
  reason: z.string().trim().min(2, "Informe o motivo da pausa.").max(1000),
});
export type TicketPauseInput = z.infer<typeof ticketPauseInputSchema>;

// Chamado Resumido (Listagens)
export const ticketSummarySchema = z.object({
  id: z.uuid(),
  ticketNumber: z.string(),
  trackToken: z.string(),
  status: ticketStatusSchema,
  priority: ticketPrioritySchema,
  approvalStatus: ticketApprovalStatusSchema,
  categoryName: z.string(),
  categoryId: z.uuid(),
  subcategoryName: z.string().nullable().optional(),
  subcategoryId: z.uuid().nullable().optional(),
  requesterAccountId: z.uuid(),
  requesterName: z.string(),
  requesterEmail: z.string().nullable().optional(),
  requesterEmployeeNumber: z.string().nullable().optional(),
  beneficiaryName: z.string().nullable().optional(),
  unitName: z.string().nullable().optional(),
  unitId: z.uuid().nullable().optional(),
  technicianName: z.string().nullable().optional(),
  assignedTechAccountId: z.uuid().nullable().optional(),
  areaResponsavel: technicalAreaSchema.nullable().optional(),
  isRemote: z.boolean().default(false),
  presential: z.boolean().default(true),
  requiresCauseSolution: z.boolean().default(true),
  hasFeedback: z.boolean().default(false),
  slaDeadline: z.string().nullable().optional(),
  openedAt: z.string(),
  completedAt: z.string().nullable().optional(),
  updatedAt: z.string(),
});
export type TicketSummary = z.infer<typeof ticketSummarySchema>;

// Chamado Detalhado
export const ticketDetailSchema = ticketSummarySchema.extend({
  freeTextDescription: z.string().nullable().optional(),
  anyDeskCode: z.string().nullable().optional(),
  extraData: z.record(z.string(), z.unknown()).nullable().optional(),
  cause: z.string().nullable().optional(),
  solution: z.string().nullable().optional(),
  completionNote: z.string().nullable().optional(),
  cancelNote: z.string().nullable().optional(),
  pauseNote: z.string().nullable().optional(),
  pausedAt: z.string().nullable().optional(),
  totalPausedMs: z.number().default(0),
  viewedAt: z.string().nullable().optional(),
  enRouteAt: z.string().nullable().optional(),
  inServiceAt: z.string().nullable().optional(),
  reopenedAt: z.string().nullable().optional(),
  messages: z.array(ticketMessageSchema).default([]),
  events: z.array(ticketEventSchema).default([]),
  approvals: z.array(ticketApprovalSchema).default([]),
  feedback: ticketFeedbackSchema.nullable().optional(),
});
export type TicketDetail = z.infer<typeof ticketDetailSchema>;

// Analytics / Métricas
export const ticketAnalyticsSummarySchema = z.object({
  total: z.number(),
  open: z.number(),
  inService: z.number(),
  completed: z.number(),
  cancelled: z.number(),
  paused: z.number(),
  slaBreachedCount: z.number(),
  slaCompliancePercentage: z.number(),
  averageRating: z.number().nullable().optional(),
  totalFeedbacks: z.number(),
  byCategory: z.array(
    z.object({
      categoryId: z.uuid(),
      categoryName: z.string(),
      count: z.number(),
    }),
  ),
  byUnit: z.array(
    z.object({
      unitId: z.uuid().nullable(),
      unitName: z.string(),
      count: z.number(),
    }),
  ),
  byTechnician: z.array(
    z.object({
      technicianId: z.uuid().nullable(),
      technicianName: z.string(),
      count: z.number(),
    }),
  ),
});
export type TicketAnalyticsSummary = z.infer<
  typeof ticketAnalyticsSummarySchema
>;
