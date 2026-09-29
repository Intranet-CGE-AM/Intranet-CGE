import { describe, expect, it } from "vitest";

import {
  auditDocumentActionPermissions,
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
    ["in_review", "cancel", "cancelled"],
    ["correction_requested", "cancel", "cancelled"],
    ["approved", "reopen", "in_review"],
  ] as const)("%s + %s -> %s", (status, action, next) => {
    expect(nextAuditDocumentStatus(status, action)).toBe(next);
  });

  it.each([
    ["in_review", "submit_version"],
    ["in_review", "reopen"],
    ["correction_requested", "approve"],
    ["correction_requested", "request_correction"],
    ["correction_requested", "reopen"],
    ["approved", "approve"],
    ["approved", "cancel"],
    ["approved", "submit_version"],
  ] as const)("rejects %s + %s", (status, action) => {
    expect(nextAuditDocumentStatus(status, action)).toBeNull();
  });

  it("keeps cancelled terminal", () => {
    for (const action of auditDocumentActionSchema.options)
      expect(nextAuditDocumentStatus("cancelled", action)).toBeNull();
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
    });
  });
});
