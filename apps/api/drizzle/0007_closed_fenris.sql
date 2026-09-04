CREATE TYPE "public"."asset_status" AS ENUM('active', 'maintenance', 'disposed');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patrimony_number" text NOT NULL,
	"description" text NOT NULL,
	"brand" text,
	"model" text,
	"serial_number" text,
	"status" "asset_status" DEFAULT 'active' NOT NULL,
	"unit_id" uuid,
	"responsible_person_id" uuid,
	"room" text,
	"usage_date" date,
	"document_number" text,
	"document_date" date,
	"commitment_number" text,
	"conservation_status" text,
	"renavam" text,
	"chassis" text,
	"acquisition_date" date,
	"acquisition_value" numeric(14, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_patrimony_number_unique" UNIQUE("patrimony_number")
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_unit_id_organization_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_responsible_person_id_people_id_fk" FOREIGN KEY ("responsible_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;