import {
  permissionAllows,
  type PermissionGrant,
  type PermissionKey,
} from "@cge/contracts";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Transaction } from "../../db/client.js";
import { employmentRelationships, people } from "./schema.js";
import {
  employmentMovements,
  fieldProvenance,
  type FieldValue,
} from "./history-schema.js";
import { auditEvents } from "../audit/schema.js";
import { userAccounts } from "../auth/schema.js";
import { deactivateAccountInTransaction } from "../auth/service.js";

export type { Transaction } from "../../db/client.js";
export type MovementContext = {
  actorAccountId: string;
  permissions: readonly PermissionGrant[];
  permission: PermissionKey;
  reason: string;
  effectiveOn: string;
  expectedVersion?: number;
  source?: "manual" | "import";
  importRunId?: string;
  checksum?: string;
};
const fields = [
  "categoryId",
  "unitId",
  "supervisorRelationshipId",
  "employeeNumber",
  "startDate",
  "endDate",
  "jobTitle",
] as const;
type Employment = typeof employmentRelationships.$inferSelect;
type Changes = Partial<Pick<Employment, (typeof fields)[number]>>;
export const historyError = (statusCode: number, message: string): never => {
  throw Object.assign(new Error(message), { statusCode });
};

export async function recordAdmission(
  tx: Transaction,
  employment: Employment,
  actorAccountId: string,
  origin?: { importRunId: string; checksum: string },
) {
  await tx.insert(employmentMovements).values({
    employmentId: employment.id,
    version: employment.version,
    type: "admission",
    next: employment.startDate,
    effectiveOn: employment.startDate,
    reason: "Cadastro inicial do vínculo",
    actorAccountId,
    source: origin ? "import" : "manual",
    ...origin,
  });
}

export async function changeEmployment(
  tx: Transaction,
  personId: string,
  changes: Changes,
  context: MovementContext,
) {
  await tx
    .select({ id: people.id })
    .from(people)
    .where(eq(people.id, personId))
    .for("update");
  const [before] = await tx
    .select()
    .from(employmentRelationships)
    .where(
      and(
        eq(employmentRelationships.personId, personId),
        isNull(employmentRelationships.endDate),
      ),
    )
    .for("update");
  if (!before) return historyError(404, "Vínculo ativo não encontrado.");
  if (
    !permissionAllows(context.permissions, context.permission, before.unitId) ||
    (changes.unitId &&
      !permissionAllows(
        context.permissions,
        context.permission,
        changes.unitId,
      ))
  )
    return historyError(
      403,
      "Movimentação exige autorização nas unidades de origem e destino.",
    );
  if (
    context.expectedVersion !== undefined &&
    before.version !== context.expectedVersion
  )
    return historyError(
      409,
      "O vínculo foi alterado. Atualize os dados antes de continuar.",
    );
  if (
    context.effectiveOn < before.startDate ||
    (changes.endDate && changes.endDate < before.startDate)
  )
    return historyError(
      400,
      "A vigência não pode anteceder o início do vínculo.",
    );
  const [latest] = await tx
    .select({ effectiveOn: employmentMovements.effectiveOn })
    .from(employmentMovements)
    .where(eq(employmentMovements.employmentId, before.id))
    .orderBy(desc(employmentMovements.effectiveOn))
    .limit(1);
  if (latest && context.effectiveOn < latest.effectiveOn)
    return historyError(
      409,
      "A retificação deve ter vigência igual ou posterior à última movimentação.",
    );
  const changed = fields.filter(
    (field) => changes[field] !== undefined && changes[field] !== before[field],
  );
  if (!changed.length) return before;
  const releasedPositionId = changed.includes("unitId")
    ? before.positionId
    : null;
  const [after] = await tx
    .update(employmentRelationships)
    .set({
      ...changes,
      ...(releasedPositionId ? { positionId: null } : {}),
      version: before.version + 1,
      updatedAt: new Date(),
    })
    .where(eq(employmentRelationships.id, before.id))
    .returning();
  if (!after) throw new Error("Employment not updated");
  await tx.insert(employmentMovements).values(
    changed.map((field) => ({
      employmentId: before.id,
      version: after.version,
      type: field,
      previous: before[field],
      next: after[field],
      effectiveOn: context.effectiveOn,
      reason: context.reason,
      actorAccountId: context.actorAccountId,
      source: context.source ?? "manual",
      importRunId: context.importRunId,
      checksum: context.checksum,
    })),
  );
  if (context.source !== "import")
    await recordManualFields(
      tx,
      personId,
      Object.fromEntries(
        changed.map((field) => [`employment.${field}`, after[field]]),
      ),
    );
  if (after.endDate) {
    const accounts = await tx
      .select({ id: userAccounts.id })
      .from(userAccounts)
      .where(eq(userAccounts.personId, personId));
    for (const account of accounts) {
      await deactivateAccountInTransaction(
        tx,
        account.id,
        context.actorAccountId,
      );
    }
  }
  await tx.insert(auditEvents).values({
    actorAccountId: context.actorAccountId,
    action: "employment.moved",
    objectType: "employment",
    objectId: before.id,
    outcome: "success",
    metadata: {
      fields: changed,
      version: after.version,
      reason: context.reason,
      ...(releasedPositionId ? { releasedPositionId } : {}),
    },
  });
  return after;
}

export async function recordManualFields(
  tx: Transaction,
  personId: string,
  values: Record<string, FieldValue>,
) {
  for (const [field, value] of Object.entries(values)) {
    await tx
      .insert(fieldProvenance)
      .values({ personId, field, value, source: "manual" })
      .onConflictDoUpdate({
        target: [fieldProvenance.personId, fieldProvenance.field],
        set: { value, source: "manual", updatedAt: new Date() },
      });
  }
}

export async function mergeImportedFields(
  tx: Transaction,
  personId: string,
  incoming: Record<string, FieldValue>,
  current: Record<string, FieldValue>,
  origin: { importRunId: string; checksum: string },
  confirmedFields: readonly string[] = [],
) {
  const known = await tx
    .select()
    .from(fieldProvenance)
    .where(eq(fieldProvenance.personId, personId));
  const result = { ...incoming };
  for (const [field, externalValue] of Object.entries(incoming)) {
    const previous = known.find((item) => item.field === field);
    // Sem proveniência, dados legados são preservados até reconciliação explícita.
    const manual =
      !confirmedFields.includes(field) &&
      (previous?.source === "manual" ||
        (!previous && Object.hasOwn(current, field)));
    const value = manual
      ? Object.hasOwn(current, field)
        ? (current[field] ?? null)
        : (previous?.value ?? null)
      : externalValue;
    result[field] = value;
    const state = {
      value,
      externalValue,
      source: manual ? "manual" : "import",
      importRunId: origin.importRunId,
      checksum: origin.checksum,
      syncedAt: new Date(),
      updatedAt:
        previous && previous.value === value ? previous.updatedAt : new Date(),
    };
    await tx
      .insert(fieldProvenance)
      .values({ personId, field, ...state })
      .onConflictDoUpdate({
        target: [fieldProvenance.personId, fieldProvenance.field],
        set: state,
      });
  }
  return result;
}
