import { and, eq, gte, lte, ne } from "drizzle-orm";
import type { Transaction } from "../../db/client.js";
import { employmentRelationships } from "../people/schema.js";
import { occurrences } from "../occurrences/schema.js";
import { vacationRequests } from "./schema.js";

export async function assertAvailablePeriod(
  tx: Transaction,
  employmentId: string,
  startDate: string,
  endDate: string,
  exceptId?: string,
) {
  // Both workflows lock the same employment before confirming, including automatic approval.
  const [employment] = await tx
    .select({ endDate: employmentRelationships.endDate })
    .from(employmentRelationships)
    .where(eq(employmentRelationships.id, employmentId))
    .for("update");
  if (!employment || employment.endDate)
    throw Object.assign(
      new Error("O vínculo não está ativo para confirmar o período."),
      { statusCode: 409 },
    );
  const [vacation] = await tx
    .select({ id: vacationRequests.id })
    .from(vacationRequests)
    .where(
      and(
        eq(vacationRequests.employmentRelationshipId, employmentId),
        eq(vacationRequests.status, "final_approved"),
        lte(vacationRequests.startDate, endDate),
        gte(vacationRequests.endDate, startDate),
        exceptId ? ne(vacationRequests.id, exceptId) : undefined,
      ),
    )
    .limit(1);
  const [occurrence] = await tx
    .select({ id: occurrences.id })
    .from(occurrences)
    .where(
      and(
        eq(occurrences.employmentId, employmentId),
        eq(occurrences.status, "final_approved"),
        lte(occurrences.startDate, endDate),
        gte(occurrences.endDate, startDate),
        exceptId ? ne(occurrences.id, exceptId) : undefined,
      ),
    )
    .limit(1);
  if (vacation || occurrence)
    throw Object.assign(
      new Error(
        "O período se sobrepõe a férias ou ocorrência já aprovada. Revise as datas.",
      ),
      { statusCode: 409 },
    );
}
