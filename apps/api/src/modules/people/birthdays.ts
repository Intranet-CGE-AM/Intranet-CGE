import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import {
  employmentRelationships,
  organizationUnits,
  people,
} from "./schema.js";

export function dateInManaus(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function birthdayDistance(birthDate: string, today: string) {
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  const [, month, day] = birthDate.split("-").map(Number);
  const todayUtc = Date.UTC(todayYear!, todayMonth! - 1, todayDay);
  const candidate = (year: number) => {
    const value = new Date(Date.UTC(year, month! - 1, day));
    return value.getUTCMonth() === month! - 1
      ? value.getTime()
      : Date.UTC(year, 1, 28);
  };
  let birthdayUtc = candidate(todayYear!);
  if (birthdayUtc < todayUtc) {
    birthdayUtc = candidate(todayYear! + 1);
  }
  return Math.round((birthdayUtc - todayUtc) / 86_400_000);
}

export async function listBirthdays(
  db: Database,
  unitIds: string[] | null,
  days: number,
  now = new Date(),
) {
  const today = dateInManaus(now);
  const rows = await db
    .select({
      personId: people.id,
      fullName: people.fullName,
      preferredName: people.preferredName,
      birthDate: people.birthDate,
      unitId: organizationUnits.id,
      unitCode: organizationUnits.code,
      unitName: organizationUnits.name,
    })
    .from(people)
    .innerJoin(
      employmentRelationships,
      and(
        eq(employmentRelationships.personId, people.id),
        isNull(employmentRelationships.endDate),
      ),
    )
    .innerJoin(
      organizationUnits,
      eq(employmentRelationships.unitId, organizationUnits.id),
    )
    .where(
      and(
        eq(people.birthdayVisible, true),
        isNotNull(people.birthDate),
        unitIds === null
          ? undefined
          : unitIds.length
            ? inArray(employmentRelationships.unitId, unitIds)
            : sql`false`,
      ),
    );

  return rows
    .flatMap((row) => {
      if (!row.birthDate) {
        return [];
      }
      const daysUntil = birthdayDistance(row.birthDate, today);
      const [, month, day] = row.birthDate.split("-").map(Number);
      return daysUntil <= days
        ? [
            {
              personId: row.personId,
              displayName: row.preferredName ?? row.fullName,
              day: day!,
              month: month!,
              daysUntil,
              unit: {
                id: row.unitId,
                code: row.unitCode,
                name: row.unitName,
              },
            },
          ]
        : [];
    })
    .sort(
      (left, right) =>
        left.daysUntil - right.daysUntil ||
        left.displayName.localeCompare(right.displayName, "pt-BR"),
    );
}
