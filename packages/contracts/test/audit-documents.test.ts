import { describe, expect, it } from "vitest";

import {
  auditDocumentActionPermissions,
  auditDocumentInputSchema,
  auditDocumentSettingsSchema,
  auditDocumentVersionInputSchema,
  auditDocumentActionSchema,
  auditDocumentTransitionSchema,
  auditDocumentStatusSchema,
  nextAuditDocumentStatus,
} from "../src/audit-documents.js";

describe("audit document state machine", () => {
  it.each([
    ["in_review", "approve", "approved"],
    ["in_review", "request_correction", "correction_requested"],
    ["correction_requested", "submit_version", "in_review"],
    ["in_review", "submit_version", "in_review"],
    ["in_review", "cancel", "cancelled"],
    ["correction_requested", "cancel", "cancelled"],
    ["approved", "reopen", "in_review"],
    ["in_review", "edit_version", "in_review"],
  ] as const)("%s + %s -> %s", (status, action, next) => {
    expect(nextAuditDocumentStatus(status, action)).toBe(next);
  });

  // Every (status, action) cell; only the eight rows of the flow are legal.
  const legal: Record<string, string> = {
    "in_review:approve": "approved",
    "in_review:request_correction": "correction_requested",
    "correction_requested:submit_version": "in_review",
    "in_review:submit_version": "in_review",
    "in_review:cancel": "cancelled",
    "correction_requested:cancel": "cancelled",
    "approved:reopen": "in_review",
    "in_review:edit_version": "in_review",
  };
  const grid = auditDocumentStatusSchema.options.flatMap((status) =>
    auditDocumentActionSchema.options.map(
      (action) =>
        [status, action, legal[`${status}:${action}`] ?? null] as const,
    ),
  );

  it("covers the 24 cells of the grid", () => {
    expect(grid).toHaveLength(24);
    expect(grid.filter(([, , next]) => next === null)).toHaveLength(16);
  });

  it.each(grid)("%s + %s -> %s (full grid)", (status, action, next) => {
    expect(nextAuditDocumentStatus(status, action)).toBe(next);
  });

  it("exposes the four statuses", () => {
    expect(auditDocumentStatusSchema.options).toEqual([
      "in_review",
      "correction_requested",
      "approved",
      "cancelled",
    ]);
  });
});

describe("audit document transition input", () => {
  it.each(["request_correction", "cancel", "reopen"] as const)(
    "requires a message to %s",
    (action) => {
      expect(
        auditDocumentTransitionSchema.safeParse({ action, version: 1 }).success,
      ).toBe(false);
      expect(
        auditDocumentTransitionSchema.safeParse({
          action,
          version: 1,
          message: "Ajustar a seção 3.",
        }).success,
      ).toBe(true);
    },
  );

  it.each(["request_correction", "cancel", "reopen"] as const)(
    "rejects a whitespace-only message to %s",
    (action) => {
      expect(
        auditDocumentTransitionSchema.safeParse({
          action,
          version: 1,
          message: "   ",
        }).success,
      ).toBe(false);
    },
  );

  it.each([
    ["edit_version", { action: "edit_version", version: 1 }],
    ["unknown action", { action: "delete", version: 1 }],
    ["missing version", { action: "approve" }],
    ["zero version", { action: "approve", version: 0 }],
    ["string version", { action: "approve", version: "1" }],
    ["extra field", { action: "approve", version: 1, fileId: "x" }],
  ])("rejects a transition body with %s", (_, body) => {
    expect(auditDocumentTransitionSchema.safeParse(body).success).toBe(false);
  });

  it("approves without a message", () => {
    expect(
      auditDocumentTransitionSchema.safeParse({ action: "approve", version: 1 })
        .success,
    ).toBe(true);
  });

  it("does not accept submit_version as a plain transition", () => {
    expect(
      auditDocumentTransitionSchema.safeParse({
        action: "submit_version",
        version: 1,
      }).success,
    ).toBe(false);
  });
});

describe("audit document action permissions", () => {
  it("maps each action to the permissions that may perform it", () => {
    expect(auditDocumentActionPermissions).toEqual({
      submit_version: ["audit_documents.submit"],
      request_correction: ["audit_documents.review"],
      approve: ["audit_documents.review"],
      cancel: ["audit_documents.submit", "audit_documents.review"],
      reopen: ["audit_documents.review"],
      edit_version: ["audit_documents.review"],
    });
  });
});

describe("audit document metadata", () => {
  const unitId = "00000000-0000-4000-8000-000000000001";

  it("accepts a title with team", () => {
    expect(
      auditDocumentInputSchema.safeParse({ unitId, title: "Nota técnica" })
        .success,
    ).toBe(true);
  });

  it.each([
    ["blank title", { unitId, title: "   " }],
    ["missing title", { unitId }],
    ["non-uuid unitId", { unitId: "equipe-01", title: "Nota técnica" }],
    ["unknown field", { unitId, title: "Nota técnica", status: "approved" }],
  ])("rejects metadata with %s", (_, body) => {
    expect(auditDocumentInputSchema.safeParse(body).success).toBe(false);
  });

  it.each([
    ["missing version", {}],
    ["unknown source", { version: 1, source: "email" }],
    ["unknown field", { version: 1, uploadedAs: "reviewer" }],
  ])("rejects version metadata with %s", (_, body) => {
    expect(auditDocumentVersionInputSchema.safeParse(body).success).toBe(false);
  });
});

describe("audit document settings", () => {
  it.each([1, 20])("accepts bottleneckRounds %s", (value) => {
    expect(
      auditDocumentSettingsSchema.safeParse({ bottleneckRounds: value })
        .success,
    ).toBe(true);
  });

  it.each([
    ["0", { bottleneckRounds: 0 }],
    ["21", { bottleneckRounds: 21 }],
    ["2.5", { bottleneckRounds: 2.5 }],
    ['"3"', { bottleneckRounds: "3" }],
    ["missing field", {}],
    ["extra field", { bottleneckRounds: 3, slaDays: 5 }],
  ])("rejects bottleneckRounds %s", (_, body) => {
    expect(auditDocumentSettingsSchema.safeParse(body).success).toBe(false);
  });
});
