import {
  permissionAllows,
  permissionUnitIds,
  type AuthenticatedUser,
  type Delegation,
} from "@cge/contracts";
import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type { Database, Transaction } from "../../db/client.js";
import { employmentRelationships as employment } from "../people/schema.js";
import { occurrences } from "./schema.js";

// A mesma autoridade governa a fila, o detalhe e a decisão; substituir não amplia a equipe.
export async function occurrenceChiefAuthority(
  db: Database | Transaction,
  user: AuthenticatedUser,
) {
  const key = "occurrences.review.supervisor";
  const base = user.permissions.filter((grant) => !grant.delegation);
  const units = permissionUnitIds(base, key);
  const delegated = user.permissions.filter(
    (grant) =>
      grant.key === key &&
      grant.delegation &&
      grant.unitId &&
      permissionAllows(user.permissions, key, grant.unitId),
  );
  const chiefs = delegated.length
    ? await db
        .select({ id: employment.id, personId: employment.personId })
        .from(employment)
        .where(
          and(
            inArray(
              employment.personId,
              delegated.map((grant) => grant.delegation!.originalPersonId),
            ),
            isNull(employment.endDate),
          ),
        )
    : [];
  const entries = delegated.flatMap((grant) =>
    chiefs
      .filter((chief) => chief.personId === grant.delegation!.originalPersonId)
      .map((chief) => ({
        relationshipId: chief.id,
        unitId: grant.unitId!,
        delegation: grant.delegation!,
      })),
  );
  return {
    where: or(
      user.employment
        ? and(
            eq(occurrences.supervisorRelationshipId, user.employment.id),
            units === null
              ? sql`true`
              : units.length
                ? inArray(employment.unitId, units)
                : sql`false`,
          )
        : sql`false`,
      ...entries.map((entry) =>
        and(
          eq(occurrences.supervisorRelationshipId, entry.relationshipId),
          eq(employment.unitId, entry.unitId),
          ne(occurrences.requesterAccountId, user.account.id),
        ),
      ),
    ),
    match(
      item: {
        supervisorRelationshipId: string | null;
        requesterAccountId: string;
      },
      unitId: string,
    ): { allowed: boolean; delegation?: Delegation } {
      if (
        user.employment?.id === item.supervisorRelationshipId &&
        permissionAllows(base, key, unitId)
      )
        return { allowed: true };
      const entry =
        item.requesterAccountId !== user.account.id
          ? entries.find(
              (entry) =>
                entry.relationshipId === item.supervisorRelationshipId &&
                entry.unitId === unitId,
            )
          : undefined;
      return entry
        ? { allowed: true, delegation: entry.delegation }
        : { allowed: false };
    },
  };
}
