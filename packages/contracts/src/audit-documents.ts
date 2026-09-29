import { z } from "zod";

import type { PermissionKey } from "./access.js";
import { delegationSchema } from "./substitutions.js";

export const auditDocumentStatusSchema = z.enum([
  "in_review",
  "correction_requested",
  "approved",
  "cancelled",
]);
export const auditDocumentActionSchema = z.enum([
  "submit_version",
  "request_correction",
  "approve",
  "cancel",
  "reopen",
]);
export const auditDocumentEventTypeSchema = z.enum([
  "submitted",
  "resubmitted",
  "correction_requested",
  "approved",
  "cancelled",
  "reopened",
  "read",
]);
export type AuditDocumentStatus = z.infer<typeof auditDocumentStatusSchema>;
export type AuditDocumentAction = z.infer<typeof auditDocumentActionSchema>;
export type AuditDocumentEventType = z.infer<
  typeof auditDocumentEventTypeSchema
>;

const transitions: Record<
  AuditDocumentAction,
  Partial<Record<AuditDocumentStatus, AuditDocumentStatus>>
> = {
  submit_version: { correction_requested: "in_review" },
  request_correction: { in_review: "correction_requested" },
  approve: { in_review: "approved" },
  cancel: { in_review: "cancelled", correction_requested: "cancelled" },
  reopen: { approved: "in_review" },
};

export function nextAuditDocumentStatus(
  status: AuditDocumentStatus,
  action: AuditDocumentAction,
): AuditDocumentStatus | null {
  return transitions[action][status] ?? null;
}

/** Any listed permission, in the document's unit, allows the action. */
export const auditDocumentActionPermissions: Record<
  AuditDocumentAction,
  PermissionKey[]
> = {
  submit_version: ["audit_documents.submit"],
  request_correction: ["audit_documents.review"],
  approve: ["audit_documents.review"],
  cancel: ["audit_documents.submit", "audit_documents.review"],
  reopen: ["audit_documents.review"],
};

/** The latest file's uploader cannot decide on it (separation of duty). */
export const auditDocumentReviewActions: readonly AuditDocumentAction[] = [
  "request_correction",
  "approve",
];

export const auditDocumentEventByAction: Record<
  AuditDocumentAction,
  AuditDocumentEventType
> = {
  submit_version: "resubmitted",
  request_correction: "correction_requested",
  approve: "approved",
  cancel: "cancelled",
  reopen: "reopened",
};

const message = z.string().trim().min(3).max(2000);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

export const auditDocumentTransitionSchema = z
  .strictObject({
    action: z.enum(["request_correction", "approve", "cancel", "reopen"]),
    version: z.number().int().positive(),
    message: message.optional(),
  })
  .refine((value) => value.action === "approve" || Boolean(value.message), {
    path: ["message"],
    message: "Informe a justificativa desta ação.",
  });

/** Multipart field `metadata` (JSON) sent with the first file. */
export const auditDocumentInputSchema = z.strictObject({
  unitId: z.uuid(),
  title: z.string().trim().min(3).max(200),
  reference: optionalText(120),
  category: optionalText(80),
  note: optionalText(2000),
});

/** Multipart field `metadata` (JSON) sent with a new file version. */
export const auditDocumentVersionInputSchema = z.strictObject({
  version: z.number().int().positive(),
  note: optionalText(2000),
});

export const auditDocumentListQuerySchema = z.strictObject({
  status: auditDocumentStatusSchema.optional(),
  unitId: z.uuid().optional(),
  category: z.string().trim().max(80).optional(),
  query: z.string().trim().max(120).optional(),
  mine: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  page: z.coerce.number().int().min(1).default(1),
});

export const auditDocumentFileKindSchema = z.enum(["docx", "pdf"]);

export const auditDocumentSummarySchema = z.object({
  id: z.uuid(),
  unitId: z.uuid(),
  unitName: z.string(),
  title: z.string(),
  reference: z.string().nullable(),
  category: z.string().nullable(),
  status: auditDocumentStatusSchema,
  version: z.number().int().positive(),
  fileCount: z.number().int().nonnegative(),
  correctionRounds: z.number().int().nonnegative(),
  bottleneck: z.boolean(),
  statusChangedAt: z.date(),
  createdByAccountId: z.uuid(),
  createdByName: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const auditDocumentFileSchema = z.object({
  id: z.uuid(),
  number: z.number().int().positive(),
  fileName: z.string(),
  kind: auditDocumentFileKindSchema,
  size: z.number().int().positive(),
  sha256: z.string(),
  note: z.string().nullable(),
  uploadedByAccountId: z.uuid(),
  uploadedByName: z.string(),
  createdAt: z.date(),
});

export const auditDocumentEventSchema = z.object({
  id: z.uuid(),
  type: auditDocumentEventTypeSchema,
  fromStatus: auditDocumentStatusSchema.nullable(),
  toStatus: auditDocumentStatusSchema.nullable(),
  fileId: z.uuid().nullable(),
  message: z.string().nullable(),
  actorAccountId: z.uuid(),
  actorName: z.string(),
  delegation: delegationSchema.nullable(),
  createdAt: z.date(),
});

export const auditDocumentDetailSchema = auditDocumentSummarySchema.extend({
  files: z.array(auditDocumentFileSchema),
  events: z.array(auditDocumentEventSchema),
  allowedActions: z.array(auditDocumentActionSchema),
});

export const auditDocumentListSchema = z.object({
  documents: z.array(auditDocumentSummarySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  counts: z.record(auditDocumentStatusSchema, z.number().int().nonnegative()),
});

export const auditDocumentOptionsSchema = z.object({
  /** Units where the user may submit documents. */
  units: z.array(z.object({ id: z.uuid(), name: z.string() })),
  /** Units the user may read or review, for the list filter. */
  visibleUnits: z.array(z.object({ id: z.uuid(), name: z.string() })),
  categories: z.array(z.string()),
  maxFileBytes: z.number().int().positive(),
});

export const auditDocumentSettingsSchema = z.strictObject({
  bottleneckRounds: z.number().int().min(1).max(20),
});

export const auditDocumentMaxFileBytes = 20 * 1024 * 1024;

export type AuditDocumentTransition = z.infer<
  typeof auditDocumentTransitionSchema
>;
export type AuditDocumentInput = z.infer<typeof auditDocumentInputSchema>;
export type AuditDocumentVersionInput = z.infer<
  typeof auditDocumentVersionInputSchema
>;
export type AuditDocumentListQuery = z.input<
  typeof auditDocumentListQuerySchema
>;
export type AuditDocumentSummary = z.infer<typeof auditDocumentSummarySchema>;
export type AuditDocumentFile = z.infer<typeof auditDocumentFileSchema>;
export type AuditDocumentEvent = z.infer<typeof auditDocumentEventSchema>;
export type AuditDocumentDetail = z.infer<typeof auditDocumentDetailSchema>;
export type AuditDocumentList = z.infer<typeof auditDocumentListSchema>;
export type AuditDocumentOptions = z.infer<typeof auditDocumentOptionsSchema>;
export type AuditDocumentSettings = z.infer<typeof auditDocumentSettingsSchema>;
