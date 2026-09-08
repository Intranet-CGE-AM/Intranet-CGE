import {
  personUpdateSchema,
  type PeopleImportRequest,
  type ImportComparison,
} from "@cge/contracts";
import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "../../db/client.js";
import {
  importErrors,
  importRuns,
  type ImportPreview,
} from "./import-schema.js";
import { fieldProvenance, type FieldValue } from "./history-schema.js";
import { auditEvents } from "../audit/schema.js";
import {
  employmentCategories,
  employmentRelationships,
  organizationUnits,
  people,
} from "./schema.js";
import { parseCsv } from "./csv.js";
import {
  changeEmployment,
  mergeImportedFields,
  recordAdmission,
  historyError,
} from "./history.js";

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

async function compareImport(
  db: Database,
  rows: PreparedRow[],
): Promise<ImportPreview[]> {
  const numbers = rows.flatMap((row) =>
    row.data ? [row.data.employeeNumber] : [],
  );
  if (!numbers.length) return [];
  const existing = await db
    .select({ person: people, employment: employmentRelationships })
    .from(employmentRelationships)
    .innerJoin(people, eq(people.id, employmentRelationships.personId))
    .where(inArray(employmentRelationships.employeeNumber, numbers));
  if (!existing.length) return [];
  const [units, categories, provenance] = await Promise.all([
    db.select().from(organizationUnits),
    db.select().from(employmentCategories),
    db
      .select()
      .from(fieldProvenance)
      .where(
        inArray(
          fieldProvenance.personId,
          existing.map((item) => item.person.id),
        ),
      ),
  ]);
  const byNumber = new Map(
    existing.map((item) => [item.employment.employeeNumber, item]),
  );
  const sources = new Map(
    provenance.map((item) => [`${item.personId}:${item.field}`, item]),
  );
  const labels = new Map(
    [...units, ...categories].map((item) => [item.id, item.name]),
  );
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Manaus",
  });
  const format = (value: FieldValue) =>
    value === null
      ? "Não informado"
      : typeof value === "boolean"
        ? value
          ? "Sim"
          : "Não"
        : (labels.get(value) ??
          (/^\d{4}-\d{2}-\d{2}$/.test(value)
            ? value.split("-").reverse().join("/")
            : value));
  return rows.flatMap(({ data }) => {
    if (!data) return [];
    const found = byNumber.get(data.employeeNumber);
    if (!found) return [];
    const { person, employment } = found;
    const values: [ImportComparison["field"], FieldValue, FieldValue][] = [
      ["fullName", person.fullName, data.fullName],
      ["preferredName", person.preferredName, data.preferredName],
      ["birthDate", person.birthDate, data.birthDate],
      ["birthdayVisible", person.birthdayVisible, data.birthdayVisible],
      [
        "employment.categoryId",
        employment.categoryId,
        categories.find((item) => item.name === data.categoryName)?.id ??
          data.categoryName,
      ],
      [
        "employment.unitId",
        employment.unitId,
        units.find((item) => item.code === data.unitCode)?.id ?? data.unitName,
      ],
      ["employment.jobTitle", employment.jobTitle, data.jobTitle],
      ["employment.startDate", employment.startDate, data.startDate],
      [
        "employment.endDate",
        employment.endDate,
        data.active ? null : (employment.endDate ?? today),
      ],
    ];
    return [
      {
        employeeNumber: data.employeeNumber,
        personId: person.id,
        version: employment.version,
        updatedAt: person.updatedAt.toISOString(),
        comparisons: values.map(([field, localValue, importedValue]) => {
          const source = sources.get(`${person.id}:${field}`);
          return {
            field,
            localValue,
            importedValue,
            localLabel: format(localValue),
            importedLabel: format(importedValue),
            source: source?.source ?? "manual",
            updatedAt: (source?.updatedAt ?? person.updatedAt).toISOString(),
            state:
              localValue === importedValue
                ? ("synchronized" as const)
                : ("divergent" as const),
          };
        }),
      },
    ];
  });
}

export async function runPeopleImport(
  db: Database,
  accountId: string,
  input: PeopleImportRequest,
) {
  const checksum = createHash("sha256").update(input.csv).digest("hex");
  const rows = await preparePeopleImport(db, input.csv);
  const preview = input.mode === "preview" ? await compareImport(db, rows) : [];
  let confirmed: ImportPreview[] = [];
  if (input.reconciliation) {
    if (input.mode !== "apply")
      return historyError(
        400,
        "A confirmação só pode ser usada ao aplicar a importação.",
      );
    const [previous] = await db
      .select()
      .from(importRuns)
      .where(
        and(
          eq(importRuns.id, input.reconciliation.previewId),
          eq(importRuns.createdByAccountId, accountId),
          eq(importRuns.status, "previewed"),
          eq(importRuns.checksum, checksum),
        ),
      );
    if (!previous?.preview)
      return historyError(
        409,
        "Valide novamente o mesmo arquivo antes de confirmar a substituição.",
      );
    confirmed = previous.preview;
    for (const selected of input.reconciliation.fields) {
      if (
        !confirmed
          .find((row) => row.employeeNumber === selected.employeeNumber)
          ?.comparisons.some(
            (item) =>
              item.field === selected.field && item.state === "divergent",
          )
      )
        return historyError(
          400,
          "A confirmação contém um campo que não divergia na prévia.",
        );
    }
  }
  const [run] = await db
    .insert(importRuns)
    .values({
      checksum,
      preview: input.mode === "preview" ? preview : null,
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
        await applyRow(
          db,
          row.data,
          {
            accountId,
            importRunId: run.id,
            checksum,
          },
          input.reconciliation?.fields
            .filter((item) => item.employeeNumber === row.data!.employeeNumber)
            .map((item) => item.field) ?? [],
          confirmed.find(
            (item) => item.employeeNumber === row.data!.employeeNumber,
          ),
        );
        successfulRows += 1;
      } catch (cause) {
        row.action = "invalid";
        row.errors.push({
          field: null,
          message:
            cause instanceof Error && "statusCode" in cause
              ? cause.message
              : "Não foi possível aplicar esta linha.",
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
      comparisons:
        preview.find((item) => item.employeeNumber === row.data?.employeeNumber)
          ?.comparisons ?? [],
      errors: row.errors,
    })),
  };
}

async function applyRow(
  db: Database,
  row: ImportRow,
  origin: { accountId: string; importRunId: string; checksum: string },
  confirmedFields: string[] = [],
  preview?: ImportPreview,
) {
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
    }
    if (!category || !unit) {
      throw new Error("Import references were not created");
    }
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Manaus",
    });
    const incoming = {
      fullName: row.fullName,
      preferredName: row.preferredName,
      birthDate: row.birthDate,
      birthdayVisible: row.birthdayVisible,
      "employment.categoryId": category.id,
      "employment.unitId": unit.id,
      "employment.jobTitle": row.jobTitle,
      "employment.startDate": row.startDate,
      "employment.endDate": row.active ? null : today,
    };

    const [existing] = await transaction
      .select({
        employmentId: employmentRelationships.id,
        personId: employmentRelationships.personId,
      })
      .from(employmentRelationships)
      .where(eq(employmentRelationships.employeeNumber, row.employeeNumber))
      .limit(1);

    if (existing) {
      const [person] = await transaction
        .select()
        .from(people)
        .where(eq(people.id, existing.personId))
        .for("update");
      const [employment] = await transaction
        .select()
        .from(employmentRelationships)
        .where(eq(employmentRelationships.id, existing.employmentId))
        .for("update");
      if (!person || !employment)
        throw new Error("Imported employment disappeared");
      if (
        confirmedFields.length &&
        (!preview ||
          preview.personId !== person.id ||
          preview.version !== employment.version ||
          preview.updatedAt !== person.updatedAt.toISOString())
      )
        return historyError(
          409,
          "O cadastro mudou após a prévia. Valide novamente antes de substituir campos.",
        );
      if (employment.endDate) {
        if (row.active)
          throw new Error("A importação não pode reabrir vínculo encerrado.");
        return;
      }
      const resolved = await mergeImportedFields(
        transaction,
        person.id,
        incoming,
        {
          fullName: person.fullName,
          preferredName: person.preferredName,
          birthDate: person.birthDate,
          birthdayVisible: person.birthdayVisible,
          "employment.categoryId": employment.categoryId,
          "employment.unitId": employment.unitId,
          "employment.jobTitle": employment.jobTitle,
          "employment.startDate": employment.startDate,
          "employment.endDate": employment.endDate,
        },
        origin,
        confirmedFields,
      );
      const update = personUpdateSchema.parse({
        fullName: resolved.fullName,
        preferredName: resolved.preferredName,
        birthDate: resolved.birthDate,
        birthdayVisible: resolved.birthdayVisible,
        employment: {
          categoryId: resolved["employment.categoryId"],
          unitId: resolved["employment.unitId"],
          jobTitle: resolved["employment.jobTitle"],
          startDate: resolved["employment.startDate"],
        },
      });
      const { employment: changes, ...personal } = update;
      await transaction
        .update(people)
        .set({ ...personal, updatedAt: new Date() })
        .where(eq(people.id, person.id));
      await changeEmployment(
        transaction,
        person.id,
        {
          ...changes,
          endDate: z.iso
            .date()
            .nullable()
            .parse(resolved["employment.endDate"]),
        },
        {
          actorAccountId: origin.accountId,
          permissions: [{ key: "people.import", unitId: null }],
          permission: "people.import",
          reason: "Sincronização por importação de colaboradores",
          effectiveOn: today,
          source: "import",
          importRunId: origin.importRunId,
          checksum: origin.checksum,
        },
      );
      if (confirmedFields.length)
        await transaction.insert(auditEvents).values({
          actorAccountId: origin.accountId,
          action: "people-import.reconciled",
          objectType: "person",
          objectId: person.id,
          outcome: "success",
          metadata: {
            importRunId: origin.importRunId,
            checksum: origin.checksum,
            fields: confirmedFields,
          },
        });
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
    const [employment] = await transaction
      .insert(employmentRelationships)
      .values({
        personId: person.id,
        employeeNumber: row.employeeNumber,
        categoryId: category.id,
        unitId: unit.id,
        jobTitle: row.jobTitle,
        startDate: row.startDate,
      })
      .returning();
    if (!employment) throw new Error("Imported employment was not created");
    await recordAdmission(transaction, employment, origin.accountId, {
      importRunId: origin.importRunId,
      checksum: origin.checksum,
    });
    await mergeImportedFields(transaction, person.id, incoming, {}, origin);
  });
}
