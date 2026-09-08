import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

export const personInputSchema = z.object({
  fullName: z.string().trim().min(2).max(180),
  preferredName: optionalText(120),
  birthDate: z.iso.date().nullable().optional(),
  birthdayVisible: z.boolean().default(false),
  employment: z.object({
    employeeNumber: z.string().trim().min(1).max(50),
    categoryId: z.uuid(),
    unitId: z.uuid(),
    supervisorRelationshipId: z.uuid().nullable().optional(),
    startDate: z.iso.date(),
    jobTitle: optionalText(160),
  }),
});

export const personUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(180).optional(),
  preferredName: optionalText(120),
  birthDate: z.iso.date().nullable().optional(),
  birthdayVisible: z.boolean().optional(),
  employment: personInputSchema.shape.employment.partial().optional(),
});

export const personSchema = z.object({
  id: z.uuid(),
  fullName: z.string(),
  preferredName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  birthDate: z.iso.date().nullable().optional(),
  birthdayVisible: z.boolean().optional(),
  employment: z
    .object({
      id: z.uuid(),
      employeeNumber: z.string().nullable(),
      categoryId: z.uuid(),
      categoryName: z.string(),
      unitId: z.uuid(),
      unitCode: z.string(),
      unitName: z.string(),
      supervisorRelationshipId: z.uuid().nullable(),
      startDate: z.iso.date(),
      endDate: z.iso.date().nullable(),
      jobTitle: z.string().nullable(),
    })
    .nullable(),
});

export const peoplePageSchema = z.object({
  people: z.array(personSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});

export const dossierSchema = personSchema.extend({
  supervisorName: z.string().nullable(),
});
export type Dossier = z.infer<typeof dossierSchema>;

export const movementLabels = {
  admission: "Ingresso",
  unitId: "Unidade",
  jobTitle: "Cargo",
  categoryId: "Categoria",
  supervisorRelationshipId: "Chefia",
  endDate: "Desligamento",
  startDate: "Início do vínculo",
  employeeNumber: "Matrícula",
} as const;
export const employmentHistorySchema = z.object({
  personName: z.string().nullable(),
  pendingChecklistCount: z.number().int().nonnegative(),
  version: z.number().int().nullable(),
  employments: z.array(
    z.object({
      id: z.uuid(),
      version: z.number().int(),
      startDate: z.iso.date(),
      endDate: z.iso.date().nullable(),
      jobTitle: z.string().nullable(),
      unitId: z.uuid(),
      categoryId: z.uuid(),
      supervisorRelationshipId: z.uuid().nullable(),
      employeeNumber: z.string().nullable(),
    }),
  ),
  movements: z.array(
    z.object({
      id: z.uuid(),
      employmentId: z.uuid(),
      version: z.number().int(),
      type: z.enum(
        Object.keys(movementLabels) as [
          keyof typeof movementLabels,
          ...(keyof typeof movementLabels)[],
        ],
      ),
      previous: z.string().nullable(),
      next: z.string().nullable(),
      previousLabel: z.string().nullable(),
      nextLabel: z.string().nullable(),
      effectiveOn: z.iso.date(),
      reason: z.string(),
      source: z.string(),
      importRunId: z.uuid().nullable(),
      checksum: z.string().nullable(),
      createdAt: z.date(),
      actorName: z.string().nullable(),
    }),
  ),
  provenance: z.array(
    z.object({
      field: z.string(),
      value: z.union([z.string(), z.boolean(), z.null()]),
      externalValue: z.union([z.string(), z.boolean(), z.null()]),
      localLabel: z.string(),
      externalLabel: z.string(),
      state: z.enum(["synchronized", "divergent", "pending", "unavailable"]),
      source: z.string(),
      importRunId: z.uuid().nullable(),
      checksum: z.string().nullable(),
      syncedAt: z.date().nullable(),
      updatedAt: z.date(),
    }),
  ),
});
export type EmploymentHistory = z.infer<typeof employmentHistorySchema>;

export const employmentCategoryInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  vacationEligible: z.boolean().default(false),
});

export const employmentCategorySchema = employmentCategoryInputSchema.extend({
  id: z.uuid(),
  active: z.boolean(),
});

export const organizationUnitInputSchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(2).max(160),
  parentId: z.uuid().nullable().optional(),
});

export const organizationUnitSchema = organizationUnitInputSchema.extend({
  id: z.uuid(),
  active: z.boolean(),
  parentId: z.uuid().nullable(),
});

export const importedFieldSchema = z.enum([
  "fullName",
  "preferredName",
  "birthDate",
  "birthdayVisible",
  "employment.categoryId",
  "employment.unitId",
  "employment.jobTitle",
  "employment.startDate",
  "employment.endDate",
]);
export const importComparisonSchema = z.object({
  field: importedFieldSchema,
  localValue: z.union([z.string(), z.boolean(), z.null()]),
  importedValue: z.union([z.string(), z.boolean(), z.null()]),
  localLabel: z.string(),
  importedLabel: z.string(),
  source: z.string(),
  updatedAt: z.string(),
  state: z.enum(["synchronized", "divergent"]),
});
export type ImportComparison = z.infer<typeof importComparisonSchema>;

export const peopleImportRequestSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  csv: z.string().min(1).max(5_000_000),
  mode: z.enum(["preview", "apply"]),
  reconciliation: z
    .strictObject({
      previewId: z.uuid(),
      fields: z
        .array(
          z.strictObject({
            employeeNumber: z.string().min(1).max(50),
            field: importedFieldSchema,
          }),
        )
        .min(1)
        .max(5000),
    })
    .optional(),
});

export const peopleImportRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  employeeNumber: z.string().nullable(),
  action: z.enum(["create", "update", "deactivate", "invalid"]),
  comparisons: z.array(importComparisonSchema),
  errors: z.array(
    z.object({
      field: z.string().nullable(),
      message: z.string(),
    }),
  ),
});

export const peopleImportResultSchema = z.object({
  importRunId: z.uuid().nullable(),
  checksum: z.string(),
  totalRows: z.number().int(),
  successfulRows: z.number().int(),
  failedRows: z.number().int(),
  rows: z.array(peopleImportRowSchema),
});

export const birthdaySchema = z.object({
  personId: z.uuid(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  day: z.number().int().min(1).max(31),
  month: z.number().int().min(1).max(12),
  daysUntil: z.number().int().min(0),
  unit: z.object({
    id: z.uuid(),
    code: z.string(),
    name: z.string(),
  }),
});

export type PersonInput = z.infer<typeof personInputSchema>;
export type PersonUpdate = z.infer<typeof personUpdateSchema>;
export type EmploymentCategoryInput = z.infer<
  typeof employmentCategoryInputSchema
>;
export type EmploymentCategory = z.infer<typeof employmentCategorySchema>;
export type OrganizationUnitInput = z.infer<typeof organizationUnitInputSchema>;
export type PeopleImportRequest = z.infer<typeof peopleImportRequestSchema>;
export type PeopleImportResult = z.infer<typeof peopleImportResultSchema>;
export type Person = z.infer<typeof personSchema>;
export type PeoplePageResult = z.infer<typeof peoplePageSchema>;
export type OrganizationUnit = z.infer<typeof organizationUnitSchema>;
export type Birthday = z.infer<typeof birthdaySchema>;
