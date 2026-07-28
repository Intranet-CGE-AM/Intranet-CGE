import type { Database } from "../../db/client.js";
import { auditEvents } from "./schema.js";

export type AuditInput = {
  actorAccountId?: string | null;
  action: string;
  objectType: string;
  objectId?: string | null;
  outcome: "success" | "failure" | "denied";
  metadata?: Record<string, unknown>;
};

export async function recordAudit(db: Database, input: AuditInput) {
  await db.insert(auditEvents).values({
    actorAccountId: input.actorAccountId,
    action: input.action,
    objectType: input.objectType,
    objectId: input.objectId,
    outcome: input.outcome,
    metadata: input.metadata,
  });
}
