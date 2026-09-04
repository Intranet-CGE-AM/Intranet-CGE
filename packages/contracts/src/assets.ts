import { z } from "zod";

export const assetStatusSchema = z.enum([
  "active",
  "maintenance",
  "disposed",
]);

/*Representa um bem que já existe no sistema*/
export type AssetStatus =
  z.infer<typeof assetStatusSchema>;

export const assetSchema = z.object({
  id: z.uuid(),

  patrimonyNumber:
    z.string().trim().min(1),

  description:
    z.string().trim().min(2),

  brand:
    z.string().nullable(),

  model:
    z.string().nullable(),

  serialNumber:
    z.string().nullable(),

  status:
    assetStatusSchema,

  unitId:
    z.uuid().nullable(),

  responsiblePersonId:
    z.uuid().nullable(),

  room:
  z.string().nullable(),

  usageDate:
    z.string().nullable(),

  documentNumber:
    z.string().nullable(),

  documentDate:
    z.string().nullable(),

  commitmentNumber:
    z.string().nullable(),

  conservationStatus:
    z.string().nullable(),

  renavam:
    z.string().nullable(),

  chassis:
    z.string().nullable(),

  acquisitionDate:
    z.string().nullable(),

  acquisitionValue:
    z.number().nullable(),

  notes:
    z.string().nullable(),

  createdAt:
    z.string(),

  updatedAt:
    z.string(),
});

export type Asset =
  z.infer<typeof assetSchema>;


/*Representa os dados enviados pelo formulário para criar um novo bem*/
export const assetCreateSchema = z.object({
  patrimonyNumber:
    z.string().trim().min(1),

  description:
    z.string().trim().min(2),

  brand:
    z.string().trim().nullable().optional(),

  model:
    z.string().trim().nullable().optional(),

  serialNumber:
    z.string().trim().nullable().optional(),

  unitId:
    z.uuid().nullable().optional(),

  responsiblePersonId:
    z.uuid().nullable().optional(),

    room:
  z.string().trim().nullable().optional(),

  usageDate:
    z.string().nullable().optional(),

  documentNumber:
    z.string().trim().nullable().optional(),

  documentDate:
    z.string().nullable().optional(),

  commitmentNumber:
    z.string().trim().nullable().optional(),

  conservationStatus:
    z.string().trim().nullable().optional(),

  renavam:
    z.string().trim().nullable().optional(),

  chassis:
    z.string().trim().nullable().optional(),

  acquisitionDate:
    z.string().nullable().optional(),

  acquisitionValue:
    z.number().nonnegative().nullable().optional(),

  notes:
    z.string().trim().nullable().optional(),
});

export type AssetCreate =
  z.infer<typeof assetCreateSchema>;