import type {
  AssetCreate,
  AssetUpdate,
   AssetMovementCreate,
} from "@cge/contracts";

import type {
  Database,
} from "../../db/client.js";

import {
  assetMovements,
  assets,
} from "./schema.js";

import {
  organizationUnits,
} from "../people/schema.js";

import {
  eq,
} from "drizzle-orm";


export class AssetService {
  constructor(
    private readonly db: Database,
  ) {}

  async list() {
    return this.db
      .select()
      .from(assets)
      .orderBy(
        assets.createdAt,
      );
  }

  async listMovements(
      assetId: string,
    ) {
      return this.db
        .select()
        .from(assetMovements)
        .where(
          eq(
            assetMovements.assetId,
            assetId,
          ),
        )
        .orderBy(
          assetMovements.createdAt,
        );
    }

  async findById(
  id: string,
) {
  const [asset] =
    await this.db
      .select()
      .from(assets)
      .where(
        eq(
          assets.id,
          id,
        ),
      )
      .limit(1);

  return asset ?? null;
}

async update(
  id: string,
  input: AssetUpdate,
) {
  const [updated] =
    await this.db
      .update(assets)
      .set({
        ...(input.patrimonyNumber !== undefined
          ? {
              patrimonyNumber:
                input.patrimonyNumber,
            }
          : {}),

        ...(input.description !== undefined
          ? {
              description:
                input.description,
            }
          : {}),

        ...(input.brand !== undefined
          ? {
              brand:
                input.brand,
            }
          : {}),

        ...(input.model !== undefined
          ? {
              model:
                input.model,
            }
          : {}),

        ...(input.serialNumber !== undefined
          ? {
              serialNumber:
                input.serialNumber,
            }
          : {}),

        ...(input.responsiblePersonId !== undefined
          ? {
              responsiblePersonId:
                input.responsiblePersonId,
            }
          : {}),

        ...(input.room !== undefined
          ? {
              room:
                input.room,
            }
          : {}),

        ...(input.usageDate !== undefined
          ? {
              usageDate:
                input.usageDate,
            }
          : {}),

        ...(input.documentNumber !== undefined
          ? {
              documentNumber:
                input.documentNumber,
            }
          : {}),

        ...(input.documentDate !== undefined
          ? {
              documentDate:
                input.documentDate,
            }
          : {}),

        ...(input.commitmentNumber !== undefined
          ? {
              commitmentNumber:
                input.commitmentNumber,
            }
          : {}),

        ...(input.conservationStatus !== undefined
          ? {
              conservationStatus:
                input.conservationStatus,
            }
          : {}),

        ...(input.renavam !== undefined
          ? {
              renavam:
                input.renavam,
            }
          : {}),

        ...(input.chassis !== undefined
          ? {
              chassis:
                input.chassis,
            }
          : {}),

        ...(input.acquisitionDate !== undefined
          ? {
              acquisitionDate:
                input.acquisitionDate,
            }
          : {}),

        ...(input.acquisitionValue !== undefined
          ? {
              acquisitionValue:
                input.acquisitionValue === null
                  ? null
                  : String(
                      input.acquisitionValue,
                    ),
            }
          : {}),

        ...(input.notes !== undefined
          ? {
              notes:
                input.notes,
            }
          : {}),

        updatedAt:
          new Date(),
      })
      .where(
        eq(
          assets.id,
          id,
        ),
      )
      .returning();

  return updated ?? null;
}
//Para mover Bem(patrimonio) de setor
async move(
  id: string,
  input: AssetMovementCreate,
) {
  return this.db.transaction(
    async (transaction) => {
      const [asset] =
        await transaction
          .select({
            id:
              assets.id,

            unitId:
              assets.unitId,
          })
          .from(assets)
          .where(
            eq(
              assets.id,
              id,
            ),
          )
          .limit(1);

      if (!asset) {
        return {
          success: false as const,
          reason:
            "ASSET_NOT_FOUND" as const,
        };
      }

      const [destinationUnit] =
        await transaction
          .select({
            id:
              organizationUnits.id,

            active:
              organizationUnits.active,
          })
          .from(
            organizationUnits,
          )
          .where(
            eq(
              organizationUnits.id,
              input.toUnitId,
            ),
          )
          .limit(1);

      if (!destinationUnit) {
        return {
          success: false as const,
          reason:
            "UNIT_NOT_FOUND" as const,
        };
      }

      if (!destinationUnit.active) {
        return {
          success: false as const,
          reason:
            "UNIT_INACTIVE" as const,
        };
      }

      if (
        asset.unitId ===
        input.toUnitId
      ) {
        return {
          success: false as const,
          reason:
            "SAME_UNIT" as const,
        };
      }

      const [movement] =
        await transaction
          .insert(
            assetMovements,
          )
          .values({
            assetId:
              asset.id,

            fromUnitId:
              asset.unitId,

            toUnitId:
              input.toUnitId,

            movementDate:
              input.movementDate,

            notes:
              input.notes ?? null,
          })
          .returning();

      const [updatedAsset] =
        await transaction
          .update(assets)
          .set({
            unitId:
              input.toUnitId,

            updatedAt:
              new Date(),
          })
          .where(
            eq(
              assets.id,
              asset.id,
            ),
          )
          .returning();

      return {
        success: true as const,
        movement,
        asset:
          updatedAsset,
      };
    },
  );
}

  async create(
    input: AssetCreate,
  ) {
    const [created] =
      await this.db
        .insert(assets)
        .values({
          patrimonyNumber:
            input.patrimonyNumber,

          description:
            input.description,

          brand:
            input.brand ?? null,

          model:
            input.model ?? null,

          serialNumber:
            input.serialNumber ?? null,

          unitId:
            input.unitId ?? null,

          responsiblePersonId:
            input.responsiblePersonId ??
            null,

          room:
            input.room ?? null,

          usageDate:
            input.usageDate ?? null,

          documentNumber:
            input.documentNumber ?? null,

          documentDate:
            input.documentDate ?? null,

          commitmentNumber:
            input.commitmentNumber ?? null,

          conservationStatus:
            input.conservationStatus ?? null,

          renavam:
            input.renavam ?? null,

          chassis:
            input.chassis ?? null,

          acquisitionDate:
            input.acquisitionDate ??
            null,

          acquisitionValue:
            input.acquisitionValue !==
              null &&
            input.acquisitionValue !==
              undefined
              ? String(
                  input.acquisitionValue,
                )
              : null,

          notes:
            input.notes ?? null,
        })
        .returning();

    return created;
  }
}