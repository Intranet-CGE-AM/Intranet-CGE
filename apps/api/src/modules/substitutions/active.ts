import { and, eq, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Database } from "../../db/client.js";
import {
  permissionAllows,
  type Delegation,
  type PermissionGrant,
  type PermissionKey,
} from "@cge/contracts";
import { userAccounts } from "../auth/schema.js";
import { people } from "../people/schema.js";
import { substitutions } from "./schema.js";

export function activeSubstitutions(db: Database, accountId: string) {
  const original = alias(userAccounts, "substitution_original");
  const substitute = alias(userAccounts, "substitution_recipient");
  return db
    .select({
      record: substitutions,
      originalPersonId: original.personId,
      substitutePersonId: substitute.personId,
      originalName: sql<string>`coalesce(${people.preferredName}, ${people.fullName})`,
    })
    .from(substitutions)
    .innerJoin(original, eq(original.id, substitutions.originalAccountId))
    .innerJoin(substitute, eq(substitute.id, substitutions.substituteAccountId))
    .innerJoin(people, eq(people.id, original.personId))
    .where(
      and(
        or(
          eq(substitutions.originalAccountId, accountId),
          eq(substitutions.substituteAccountId, accountId),
        ),
        eq(original.status, "active"),
        eq(substitute.status, "active"),
        isNull(substitutions.cancelledAt),
        sql`(now() at time zone 'America/Manaus')::date between ${substitutions.startsOn} and ${substitutions.endsOn}`,
      ),
    );
}

export type ChecklistDelegation = { unitId: string; delegation: Delegation };
export function delegationMetadata(
  grants: readonly PermissionGrant[],
  key: PermissionKey,
  unitId: string,
) {
  const delegation = permissionAllows(grants, key, unitId)
    ? grants.find(
        (grant) =>
          grant.key === key && grant.unitId === unitId && grant.delegation,
      )?.delegation
    : undefined;
  return delegation ? { delegation } : {};
}
export async function checklistDelegations(
  db: Database,
  accountId: string,
): Promise<ChecklistDelegation[]> {
  return (await activeSubstitutions(db, accountId))
    .filter(
      ({ record }) =>
        record.substituteAccountId === accountId &&
        record.flows.includes("checklist.assignment"),
    )
    .map(({ record, originalPersonId, originalName }) => ({
      unitId: record.unitId,
      delegation: {
        id: record.id,
        originalAccountId: record.originalAccountId,
        originalPersonId,
        originalName,
      },
    }));
}
