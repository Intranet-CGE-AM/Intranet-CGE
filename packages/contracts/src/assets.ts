import { z } from "zod";

export const assetStatusSchema = z.enum([
  "active",
  "maintenance",
  "disposed",
]);

/*Contrato para listar Bem patrimonio que já existe no sistema*/
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


/*Contrato para criar um novo bem*/
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

//Contrato de Editar Bem patrimonio

/*
 * Representa os dados permitidos
 * na edição cadastral de um bem.
 *
 * unitId não está presente porque
 * a alteração de setor será feita
 * através da movimentação patrimonial.
 */
export const assetUpdateSchema = z.object({
  patrimonyNumber:
    z.string().trim().min(1).optional(),

  description:
    z.string().trim().min(2).optional(),

  brand:
    z.string().trim().nullable().optional(),

  model:
    z.string().trim().nullable().optional(),

  serialNumber:
    z.string().trim().nullable().optional(),

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
    z
      .number()
      .nonnegative()
      .nullable()
      .optional(),

  notes:
    z.string().trim().nullable().optional(),
});

export type AssetUpdate =
  z.infer<typeof assetUpdateSchema>;

export const assetMovementCreateSchema = z.object({
  toUnitId:
    z.uuid(),

  movementDate:
    z.string(),

  notes:
    z.string()
      .trim()
      .nullable()
      .optional(),
});

//Contrato de movimentação de Bem patrimonio
export type AssetMovementCreate =
  z.infer<
    typeof assetMovementCreateSchema
  >;

  export const assetMovementSchema = z.object({
  id: z.uuid(),

  assetId: z.uuid(),

  fromUnitId:
    z.uuid().nullable(),

  toUnitId:
    z.uuid(),

  movementDate:
    z.string(),

  notes:
    z.string().nullable(),

  createdAt:
    z.string(),
});

export type AssetMovement =
  z.infer<
    typeof assetMovementSchema
  >;

//Contrato de disponibilidade de Bem patrimonio
export const assetDisposalCreateSchema = z.object({
  disposalDate:
    z.string(),

  reason:
    z.string()
      .trim()
      .min(2),

  notes:
    z.string()
      .trim()
      .nullable()
      .optional(),
});

export type AssetDisposalCreate =
  z.infer<
    typeof assetDisposalCreateSchema
  >;