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
  latestFileId: z.uuid(),
  latestFileName: z.string(),
  latestFileKind: auditDocumentFileKindSchema,
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

export const auditDocumentMetricsQuerySchema = z
  .strictObject({
    from: z.iso.date(),
    to: z.iso.date(),
    unitId: z.uuid().optional(),
  })
  .refine(
    ({ from, to }) =>
      to >= from && Date.parse(to) - Date.parse(from) < 366 * 86400000,
    { message: "Informe um período válido de até 366 dias." },
  );

const metricCount = z.number().int().nonnegative();
const durationStats = z.object({
  /** Intervals measured (each one ends inside the period). */
  count: metricCount,
  averageHours: z.number().nonnegative().nullable(),
  medianHours: z.number().nonnegative().nullable(),
});

/**
 * Period bounds are Manaus calendar days, `to` inclusive. "Reviewer" means an
 * account that performed approve, request_correction or reopen on any audit
 * document; "team" is everyone else.
 */
export const auditDocumentMetricsSchema = z.object({
  /** Teams in the caller's audit_documents.reports scope (filter options). */
  units: z.array(z.object({ id: z.uuid(), name: z.string() })),
  bottleneckRounds: z.number().int().positive(),
  /** Current snapshot, not limited to the period. */
  pending: z.array(
    z.object({
      unitId: z.uuid(),
      unitName: z.string(),
      /** status in_review */
      withReviewer: metricCount,
      /** status correction_requested */
      withTeam: metricCount,
      /** Oldest status_changed_at among in_review documents. */
      oldestWithReviewerSince: z.date().nullable(),
      /** Oldest status_changed_at among correction_requested documents. */
      oldestWithTeamSince: z.date().nullable(),
    }),
  ),
  period: z.object({
    /** Documents first submitted in the period. */
    submitted: metricCount,
    /** Distinct documents with an approval in the period. */
    approved: metricCount,
    /** Distinct documents cancelled in the period. */
    cancelled: metricCount,
    /** Share (0..1) of `submitted` whose current status is approved. */
    deliveryRate: z.number().min(0).max(1).nullable(),
  }),
  /** From entering in_review to the next approve or request_correction. */
  reviewerResponse: durationStats,
  /** From request_correction to the next version sent. */
  teamResponse: durationStats,
  correctionRounds: z.object({
    /** Documents submitted in the period, grouped by correction rounds. */
    distribution: z.array(
      z.object({ rounds: metricCount, documents: metricCount }),
    ),
    /** Up to 10 documents submitted in the period with the most rounds (>= 1). */
    top: z.array(
      z.object({
        id: z.uuid(),
        title: z.string(),
        unitName: z.string(),
        rounds: metricCount,
        bottleneck: z.boolean(),
      }),
    ),
  }),
  /** From file upload to its first read by a reviewer, files sent in the period. */
  firstRead: durationStats,
  reads: z.object({
    /** Files (versions) uploaded in the period. */
    files: metricCount,
    /** Of those, files already opened by a reviewer. */
    readByReviewer: metricCount,
    rate: z.number().min(0).max(1).nullable(),
  }),
});

export type AuditDocumentMetricsQuery = z.infer<
  typeof auditDocumentMetricsQuerySchema
>;
export type AuditDocumentMetrics = z.infer<typeof auditDocumentMetricsSchema>;
