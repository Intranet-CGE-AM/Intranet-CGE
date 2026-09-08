CREATE TABLE "organization_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"code" varchar(30) NOT NULL,
	"title" varchar(160) NOT NULL,
	"planned_count" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "organization_positions_planned_nonnegative" CHECK ("organization_positions"."planned_count" >= 0),
	CONSTRAINT "organization_positions_version_positive" CHECK ("organization_positions"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "employment_relationships" ADD COLUMN "position_id" uuid;--> statement-breakpoint
ALTER TABLE "organization_positions" ADD CONSTRAINT "organization_positions_unit_id_organization_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_positions_unit_code_unique" ON "organization_positions" USING btree ("unit_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_positions_id_unit_unique" ON "organization_positions" USING btree ("id","unit_id");--> statement-breakpoint
ALTER TABLE "employment_relationships" ADD CONSTRAINT "employment_position_same_unit_fk" FOREIGN KEY ("position_id","unit_id") REFERENCES "public"."organization_positions"("id","unit_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employment_relationships_position_idx" ON "employment_relationships" USING btree ("position_id");