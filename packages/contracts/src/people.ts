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

export const peopleImportRequestSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  csv: z.string().min(1).max(5_000_000),
  mode: z.enum(["preview", "apply"]),
});

export const peopleImportRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  employeeNumber: z.string().nullable(),
  action: z.enum(["create", "update", "deactivate", "invalid"]),
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
export type OrganizationUnitInput = z.infer<typeof organizationUnitInputSchema>;
export type PeopleImportRequest = z.infer<typeof peopleImportRequestSchema>;
export type Person = z.infer<typeof personSchema>;
export type OrganizationUnit = z.infer<typeof organizationUnitSchema>;
export type Birthday = z.infer<typeof birthdaySchema>;
