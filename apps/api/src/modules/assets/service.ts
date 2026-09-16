import type {
  AssetCreate,
  AssetDisposalCreate,
  AssetMovementCreate,
  AssetUpdate,
} from "@cge/contracts";

import type {
  Database,
} from "../../db/client.js";

import {
  assetDisposals,
  assetMovements,
  assets,
} from "./schema.js";

import {
  organizationUnits,
} from "../people/schema.js";

import {
  eq,
  desc,
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

  async getDashboard() {
  const [
    assetRows,
    unitRows,
    recentMovementRows,
    recentDisposalRows,
  ] = await Promise.all([
    this.db
      .select({
        id:
          assets.id,

        patrimonyNumber:
          assets.patrimonyNumber,

        status:
          assets.status,

        acquisitionValue:
          assets.acquisitionValue,

        unitId:
          assets.unitId,

        conservationStatus:
          assets.conservationStatus,
      })
      .from(assets),

    this.db
      .select({
        id:
          organizationUnits.id,

        code:
          organizationUnits.code,

        name:
          organizationUnits.name,
      })
      .from(
        organizationUnits,
      ),

    this.db
      .select({
        id:
          assetMovements.id,

        assetId:
          assetMovements.assetId,

        fromUnitId:
          assetMovements.fromUnitId,

        toUnitId:
          assetMovements.toUnitId,

        movementDate:
          assetMovements.movementDate,
      })
      .from(
        assetMovements,
      )
      .orderBy(
        desc(
          assetMovements.movementDate,
        ),
      )
      .limit(5),

    this.db
      .select({
        id:
          assetDisposals.id,

        assetId:
          assetDisposals.assetId,

        disposalDate:
          assetDisposals.disposalDate,

        reason:
          assetDisposals.reason,
      })
      .from(
        assetDisposals,
      )
      .orderBy(
        desc(
          assetDisposals.disposalDate,
        ),
      )
      .limit(5),
  ]);

  /*
   * Resumo geral
   */

  const total =
    assetRows.length;

  const active =
    assetRows.filter(
      (asset) =>
        asset.status ===
        "active",
    ).length;

  const maintenance =
    assetRows.filter(
      (asset) =>
        asset.status ===
        "maintenance",
    ).length;

  const disposed =
    assetRows.filter(
      (asset) =>
        asset.status ===
        "disposed",
    ).length;

  const totalValue =
    assetRows.reduce(
      (
        totalValue,
        asset,
      ) =>
        totalValue +
        Number(
          asset.acquisitionValue ??
            0,
        ),
      0,
    );

    const assetsWithValue =
      assetRows.filter(
        (asset) =>
          asset.acquisitionValue !==
            null &&
          Number(
            asset.acquisitionValue,
          ) > 0,
      );

    const assetsWithValueCount =
      assetsWithValue.length;

    const averageValue =
      assetsWithValueCount > 0
        ? totalValue /
          assetsWithValueCount
        : 0;

  /*
   * Mapas auxiliares
   */

  const assetById =
    new Map(
      assetRows.map(
        (asset) => [
          asset.id,
          asset,
        ],
      ),
    );

  const unitById =
    new Map(
      unitRows.map(
        (unit) => [
          unit.id,
          unit,
        ],
      ),
    );

  /*
   * Bens por setor
   */

  const unitTotals =
    new Map<
      string,
      number
    >();

  for (
    const asset of assetRows
  ) {
    if (!asset.unitId) {
      continue;
    }

    unitTotals.set(
      asset.unitId,
      (
        unitTotals.get(
          asset.unitId,
        ) ?? 0
      ) + 1,
    );
  }

  const byUnit =
    Array.from(
      unitTotals.entries(),
    )
      .map(
        ([
          unitId,
          total,
        ]) => {
          const unit =
            unitById.get(
              unitId,
            );

          return {
            unitId,
            code:
              unit?.code ??
              null,
            name:
              unit?.name ??
              null,
            total,
          };
        },
      )
      .sort(
        (a, b) =>
          b.total -
          a.total,
      );

  /*
   * Estado de conservação
   */

  const conservationTotals =
    new Map<
      string,
      number
    >();

  for (
    const asset of assetRows
  ) {
    const status =
      asset
        .conservationStatus
        ?.trim() ||
      "Não informado";

    conservationTotals.set(
      status,
      (
        conservationTotals.get(
          status,
        ) ?? 0
      ) + 1,
    );
  }

  const conservationOrder =
    [
      "Ótimo",
      "Bom",
      "Regular",
      "Ruim",
      "Inservível",
      "Não informado",
    ];

  const byConservation =
    Array.from(
      conservationTotals.entries(),
    )
      .map(
        ([
          status,
          total,
        ]) => ({
          status,
          total,
        }),
      )
      .sort(
        (a, b) => {
          const aIndex =
            conservationOrder.indexOf(
              a.status,
            );

          const bIndex =
            conservationOrder.indexOf(
              b.status,
            );

          const normalizedA =
            aIndex === -1
              ? conservationOrder.length
              : aIndex;

          const normalizedB =
            bIndex === -1
              ? conservationOrder.length
              : bIndex;

          return (
            normalizedA -
            normalizedB
          );
        },
      );

  /*
   * Movimentações recentes
   */

  const recentMovements =
    recentMovementRows.map(
      (movement) => {
        const asset =
          assetById.get(
            movement.assetId,
          );

        const fromUnit =
          movement.fromUnitId
            ? unitById.get(
                movement.fromUnitId,
              )
            : null;

        const toUnit =
          unitById.get(
            movement.toUnitId,
          );

        return {
          id:
            movement.id,

          assetId:
            movement.assetId,

          patrimonyNumber:
            asset?.patrimonyNumber ??
            null,

          movementDate:
            movement.movementDate,

          fromUnit:
            fromUnit
              ? {
                  id:
                    fromUnit.id,

                  code:
                    fromUnit.code,

                  name:
                    fromUnit.name,
                }
              : null,

          toUnit:
            toUnit
              ? {
                  id:
                    toUnit.id,

                  code:
                    toUnit.code,

                  name:
                    toUnit.name,
                }
              : null,
        };
      },
    );

  /*
   * Baixas recentes
   */

  const recentDisposals =
    recentDisposalRows.map(
      (disposal) => {
        const asset =
          assetById.get(
            disposal.assetId,
          );

        return {
          id:
            disposal.id,

          assetId:
            disposal.assetId,

          patrimonyNumber:
            asset?.patrimonyNumber ??
            null,

          disposalDate:
            disposal.disposalDate,

          reason:
            disposal.reason,
        };
      },
    );

  return {
    summary: {
      total,
      active,
      maintenance,
      disposed,

      totalValue:
        Number(
          totalValue.toFixed(
            2,
          ),
        ),

      assetsWithValueCount,

      averageValue:
        Number(
          averageValue.toFixed(
            2,
          ),
        ),
    },

    byUnit,

    byConservation,

    recentMovements,

    recentDisposals,
  };
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





//Servico de editar Bem patrimonio
async update(
  id: string,
  input: AssetUpdate,
) {

const [asset] =
  await this.db
    .select({
      id:
        assets.id,

      status:
        assets.status,
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

if (
  asset.status ===
  "disposed"
) {
  return {
    success: false as const,
    reason:
      "ASSET_DISPOSED" as const,
  };
}
  
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

  return {
  success: true as const,
  asset:
    updated,
};
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

          status:
            assets.status,
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
      if (
        asset.status ===
        "disposed"
      ) {
        return {
          success: false as const,
          reason:
            "ASSET_DISPOSED" as const,
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

//Servico de cadastro de Bem patrimonio
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

async setStatus(
  id: string,
  status:
    | "active"
    | "maintenance",
) {
  const [asset] =
    await this.db
      .select({
        id:
          assets.id,

        status:
          assets.status,
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

  if (
    asset.status ===
    "disposed"
  ) {
    return {
      success: false as const,
      reason:
        "ASSET_DISPOSED" as const,
    };
  }

  const [updated] =
    await this.db
      .update(assets)
      .set({
        status,
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

  return {
    success: true as const,
    asset:
      updated,
  };
}

//Servico de disponibilidade do Bem patrimonio
async dispose(
  id: string,
  input: AssetDisposalCreate,
) {
  return this.db.transaction(
    async (transaction) => {
      const [asset] =
        await transaction
          .select({
            id:
              assets.id,

            status:
              assets.status,
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

      if (
        asset.status ===
        "disposed"
      ) {
        return {
          success: false as const,
          reason:
            "ALREADY_DISPOSED" as const,
        };
      }

      const [disposal] =
        await transaction
          .insert(
            assetDisposals,
          )
          .values({
            assetId:
              asset.id,

            disposalDate:
              input.disposalDate,

            reason:
              input.reason,

            notes:
              input.notes ?? null,
          })
          .returning();

      const [updatedAsset] =
        await transaction
          .update(assets)
          .set({
            status:
              "disposed",

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
        disposal,
        asset:
          updatedAsset,
      };
    },
  );
}

async getDisposal(
  assetId: string,
) {
  const [disposal] =
    await this.db
      .select()
      .from(assetDisposals)
      .where(
        eq(
          assetDisposals.assetId,
          assetId,
        ),
      )
      .limit(1);

  return disposal ?? null;
}

}