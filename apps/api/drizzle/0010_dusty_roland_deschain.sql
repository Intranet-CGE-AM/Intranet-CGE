CREATE TYPE "public"."organization_unit_type" AS ENUM('department', 'sector', 'subsector');--> statement-breakpoint
ALTER TABLE "organization_units" ADD COLUMN "type" "organization_unit_type";