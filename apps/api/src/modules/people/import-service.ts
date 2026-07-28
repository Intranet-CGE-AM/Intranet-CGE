import type { PeopleImportRequest } from "@cge/contracts";
import { createHash } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "../../db/client.js";
import { importErrors, importRuns } from "./import-schema.js";
import {
  employmentCategories,
  employmentRelationships,
  organizationUnits,
  people,
} from "./schema.js";
import { parseCsv } from "./csv.js";

const headers = [
  "matricula",
  "nome",
  "nome_preferido",
  "data_nascimento",
  "aniversario_visivel",
  "categoria",
  "unidade_codigo",
  "unidade_nome",
  "cargo",
  "data_inicio",
  "ativo",
] as const;

const importRowSchema = z.object({
  employeeNumber: z.string().trim().min(1).max(50),
  fullName: z.string().trim().min(2).max(180),
  preferredName: z.string().trim().max(120).nullable(),
  birthDate: z.iso.date().nullable(),
  birthdayVisible: z.boolean(),
  categoryName: z.string().trim().min(2).max(120),
  unitCode: z.string().trim().min(1).max(30),
  unitName: z.string().trim().min(2).max(160),
  jobTitle: z.string().trim().max(160).nullable(),
  startDate: z.iso.date(),
  active: z.boolean(),
});

type ImportRow = z.infer<typeof importRowSchema>;
type PreparedRow = {
  rowNumber: number;
  data: ImportRow | null;
  raw: Record<string, string | null>;
  errors: Array<{ field: string | null; message: string }>;
  action: "create" | "update" | "deactivate" | "invalid";
};

const optional = (value: string) => value.trim() || null;

function booleanValue(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "sim"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "nao", "não"].includes(normalized)) {
    return false;
  }
  return value;
}

export async function preparePeopleImport(
  db: Database,
  csv: string,
): Promise<PreparedRow[]> {
  const parsed = parseCsv(csv);
  const receivedHeaders = parsed
    .shift()
    ?.map((value, index) =>
      index === 0 ? value.replace(/^\uFEFF/, "").trim() : value.trim(),
    );
  if (
    !receivedHeaders ||
    receivedHeaders.length !== headers.length ||
    headers.some((header, index) => receivedHeaders[index] !== header)
  ) {
    throw new Error(`Cabeçalho esperado: ${headers.join(",")}`);
  }

  const seen = new Set<string>();
  const rows: PreparedRow[] = parsed.map((values, index) => {
    const raw = Object.fromEntries(
      headers.map((header, column) => [header, values[column] ?? null]),
    );
    const parsedRow = importRowSchema.safeParse({
      employeeNumber: values[0] ?? "",
      fullName: values[1] ?? "",
      preferredName: optional(values[2] ?? ""),
      birthDate: optional(values[3] ?? ""),
      birthdayVisible: booleanValue(values[4] ?? ""),
      categoryName: values[5] ?? "",
      unitCode: values[6] ?? "",
      unitName: values[7] ?? "",
      jobTitle: optional(values[8] ?? ""),
      startDate: values[9] ?? "",
      active: booleanValue(values[10] ?? ""),
    });
    const rowNumber = index + 2;
    if (values.length !== headers.length) {
      return {
        rowNumber,
        data: null,
        raw,
        errors: [
          {
            field: null,
            message: `Esperadas ${headers.length} colunas; recebidas ${values.length}.`,
          },
        ],
        action: "invalid" as const,
      };
    }
    if (!parsedRow.success) {
      return {
        rowNumber,
        data: null,
        raw,
        errors: parsedRow.error.issues.map((issue) => ({
          field: issue.path[0]?.toString() ?? null,
          message: issue.message,
        })),
        action: "invalid" as const,
      };
    }
    if (seen.has(parsedRow.data.employeeNumber)) {
      return {
        rowNumber,
        data: null,
        raw,
        errors: [
          {
            field: "matricula",
            message: "Matrícula duplicada no arquivo.",
          },
        ],
        action: "invalid" as const,
      };
    }
    seen.add(parsedRow.data.employeeNumber);
    return {
      rowNumber,
      data: parsedRow.data,
      raw,
      errors: [],
      action: "create" as const,
    };
  });

  const employeeNumbers = rows.flatMap((row) =>
    row.data ? [row.data.employeeNumber] : [],
  );
  const existing = employeeNumbers.length
    ? await db
        .select({ employeeNumber: employmentRelationships.employeeNumber })
        .from(employmentRelationships)
        .where(inArray(employmentRelationships.employeeNumber, employeeNumbers))
    : [];
  const existingNumbers = new Set(
    existing.flatMap((row) => (row.employeeNumber ? [row.employeeNumber] : [])),
  );

  return rows.map((row) => {
    const action: PreparedRow["action"] =
      row.action === "invalid"
        ? "invalid"
        : row.data && !row.data.active
          ? "deactivate"
          : row.data && existingNumbers.has(row.data.employeeNumber)
            ? "update"
            : "create";
    return { ...row, action };
  });
}

export async function runPeopleImport(
  db: Database,
  accountId: string,
  input: PeopleImportRequest,
) {
  const checksum = createHash("sha256").update(input.csv).digest("hex");
  const rows = await preparePeopleImport(db, input.csv);
  const [run] = await db
    .insert(importRuns)
    .values({
      checksum,
      createdByAccountId: accountId,
      originalFilename: input.filename,
      status: input.mode === "preview" ? "previewed" : "processing",
      totalRows: rows.length,
    })
    .returning({ id: importRuns.id });
  if (!run) {
    throw new Error("Import run was not created");
  }

  let successfulRows = 0;
  const failures = rows.filter((row) => row.action === "invalid");
  if (input.mode === "apply") {
    for (const row of rows) {
      if (!row.data || row.action === "invalid") {
        continue;
      }
      try {
        await applyRow(db, row.data);
        successfulRows += 1;
      } catch {
        row.action = "invalid";
        row.errors.push({
          field: null,
          message: "Não foi possível aplicar esta linha.",
        });
        failures.push(row);
      }
    }
  }

  const errorRows = rows.filter((row) => row.errors.length);
  if (errorRows.length) {
    await db.insert(importErrors).values(
      errorRows.flatMap((row) =>
        row.errors.map((error) => ({
          importRunId: run.id,
          rowNumber: row.rowNumber,
          field: error.field,
          message: error.message,
          rowData: row.raw,
        })),
      ),
    );
  }
  const failedRows = new Set(failures.map((row) => row.rowNumber)).size;
  const reportedSuccessfulRows =
    input.mode === "preview" ? rows.length - failedRows : successfulRows;
  await db
    .update(importRuns)
    .set({
      status: input.mode === "preview" ? "previewed" : "completed",
      successfulRows: reportedSuccessfulRows,
      failedRows,
      completedAt: input.mode === "apply" ? new Date() : null,
    })
    .where(eq(importRuns.id, run.id));

  return {
    importRunId: run.id,
    checksum,
    totalRows: rows.length,
    successfulRows: reportedSuccessfulRows,
    failedRows,
    rows: rows.map((row) => ({
      rowNumber: row.rowNumber,
      employeeNumber: row.data?.employeeNumber ?? row.raw.matricula ?? null,
      action: row.action,
      errors: row.errors,
    })),
  };
}

async function applyRow(db: Database, row: ImportRow) {
  await db.transaction(async (transaction) => {
    let [category] = await transaction
      .select({ id: employmentCategories.id })
      .from(employmentCategories)
      .where(eq(employmentCategories.name, row.categoryName))
      .limit(1);
    if (!category) {
      [category] = await transaction
        .insert(employmentCategories)
        .values({ name: row.categoryName })
        .returning({ id: employmentCategories.id });
    }
    let [unit] = await transaction
      .select({ id: organizationUnits.id })
      .from(organizationUnits)
      .where(eq(organizationUnits.code, row.unitCode))
      .limit(1);
    if (!unit) {
      [unit] = await transaction
        .insert(organizationUnits)
        .values({ code: row.unitCode, name: row.unitName })
        .returning({ id: organizationUnits.id });
    } else {
      await transaction
        .update(organizationUnits)
        .set({ name: row.unitName })
        .where(eq(organizationUnits.id, unit.id));
    }
    if (!category || !unit) {
      throw new Error("Import references were not created");
    }

    const [existing] = await transaction
      .select({
        employmentId: employmentRelationships.id,
        personId: employmentRelationships.personId,
      })
      .from(employmentRelationships)
      .where(eq(employmentRelationships.employeeNumber, row.employeeNumber))
      .limit(1);

    if (existing) {
      await transaction
        .update(people)
        .set({
          fullName: row.fullName,
          preferredName: row.preferredName,
          birthDate: row.birthDate,
          birthdayVisible: row.birthdayVisible,
          updatedAt: new Date(),
        })
        .where(eq(people.id, existing.personId));
      await transaction
        .update(employmentRelationships)
        .set({
          categoryId: category.id,
          unitId: unit.id,
          jobTitle: row.jobTitle,
          startDate: row.startDate,
          endDate: row.active ? null : new Date().toISOString().slice(0, 10),
          updatedAt: new Date(),
        })
        .where(eq(employmentRelationships.id, existing.employmentId));
      return;
    }

    if (!row.active) {
      throw new Error("Cannot deactivate an unknown employee");
    }
    const [person] = await transaction
      .insert(people)
      .values({
        fullName: row.fullName,
        preferredName: row.preferredName,
        birthDate: row.birthDate,
        birthdayVisible: row.birthdayVisible,
      })
      .returning({ id: people.id });
    if (!person) {
      throw new Error("Imported person was not created");
    }
    await transaction.insert(employmentRelationships).values({
      personId: person.id,
      employeeNumber: row.employeeNumber,
      categoryId: category.id,
      unitId: unit.id,
      jobTitle: row.jobTitle,
      startDate: row.startDate,
    });
  });
}
