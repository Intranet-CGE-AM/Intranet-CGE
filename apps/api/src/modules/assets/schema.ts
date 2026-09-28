import {
  date,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import {
  organizationUnits,
  people,
} from "../people/schema.js";

export const assetStatus = pgEnum(
  "asset_status",
  [
    "active",
    "maintenance",
    "disposed",
  ],
);


//Patrimonio
export const assets = pgTable(
  "assets",
  {
    id:
      uuid("id")
        .primaryKey()
        .defaultRandom(),

    patrimonyNumber:
      text("patrimony_number")
        .notNull()
        .unique(),

    description:
      text("description")
        .notNull(),

    brand:
      text("brand"),

    model:
      text("model"),

    serialNumber:
      text("serial_number"),

    status:
      assetStatus("status")
        .notNull()
        .default("active"),

    unitId:
      uuid("unit_id")
        .references(
          () => organizationUnits.id,
        ),

    responsiblePersonId:
      uuid("responsible_person_id")
        .references(
          () => people.id,
        ),
    
    room:
      text("room"),

    usageDate:
      date("usage_date"),

    documentNumber:
      text("document_number"),

    documentDate:
      date("document_date"),

    commitmentNumber:
      text("commitment_number"),

    conservationStatus:
      text("conservation_status"),

    renavam:
      text("renavam"),

    chassis:
      text("chassis"),

    acquisitionDate:
      date("acquisition_date"),

    acquisitionValue:
      numeric(
        "acquisition_value",
        {
          precision: 14,
          scale: 2,
        },
      ),

    notes:
      text("notes"),

    createdAt:
      timestamp("created_at", {
        withTimezone: true,
      })
        .notNull()
        .defaultNow(),

    updatedAt:
      timestamp("updated_at", {
        withTimezone: true,
      })
        .notNull()
        .defaultNow(),
  },
);

//Movimentação do patrimonio
export const assetMovements = pgTable(
  "asset_movements",
  {
    id:
      uuid("id")
        .primaryKey()
        .defaultRandom(),

    assetId:
      uuid("asset_id")
        .notNull()
        .references(
          () => assets.id,
        ),

    fromUnitId:
      uuid("from_unit_id")
        .references(
          () => organizationUnits.id,
        ),

    toUnitId:
      uuid("to_unit_id")
        .notNull()
        .references(
          () => organizationUnits.id,
        ),

    movementDate:
      date("movement_date")
        .notNull(),

    notes:
      text("notes"),

    createdAt:
      timestamp("created_at", {
        withTimezone: true,
      })
        .notNull()
        .defaultNow(),
  },
);

//Disponibilidade o Patrimonio
export const assetDisposals = pgTable(
  "asset_disposals",
  {
    id:
      uuid("id")
        .primaryKey()
        .defaultRandom(),

    assetId:
      uuid("asset_id")
        .notNull()
        .references(
          () => assets.id,
        ),

    disposalDate:
      date("disposal_date")
        .notNull(),

    reason:
      text("reason")
        .notNull(),

    notes:
      text("notes"),

    createdAt:
      timestamp("created_at", {
        withTimezone: true,
      })
        .notNull()
        .defaultNow(),
  },
);