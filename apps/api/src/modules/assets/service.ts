import type {
  AssetCreate,
} from "@cge/contracts";

import type {
  Database,
} from "../../db/client.js";

import {
  assets,
} from "./schema.js";

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