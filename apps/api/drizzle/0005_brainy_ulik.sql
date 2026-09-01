CREATE TYPE "public"."visit_status" AS ENUM('pending', 'approved', 'scheduled', 'in_progress', 'completed', 'cancelled', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."visit_type" AS ENUM('institutional_meeting', 'technical_support', 'technical_visit', 'alignment_meeting', 'presentation', 'audit', 'inspection', 'training', 'external_service', 'other');--> statement-breakpoint
CREATE TABLE "visit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid NOT NULL,
	"actor_account_id" uuid NOT NULL,
	"type" text NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visit_visitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" text,
	"organization" text NOT NULL,
	"sector" text,
	"email" text,
	"phone" text,
	"cpf" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol" text NOT NULL,
	"type" "visit_type" NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"organization" text NOT NULL,
	"sector" text,
	"scheduled_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"location" text NOT NULL,
	"responsible_unit_id" uuid,
	"responsible_account_id" uuid,
	"created_by_account_id" uuid NOT NULL,
	"status" "visit_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visits_protocol_unique" UNIQUE("protocol"),
	CONSTRAINT "visits_valid_time" CHECK ("visits"."end_time" > "visits"."start_time")
);
--> statement-breakpoint
ALTER TABLE "visit_events" ADD CONSTRAINT "visit_events_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_events" ADD CONSTRAINT "visit_events_actor_account_id_user_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_visitors" ADD CONSTRAINT "visit_visitors_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_responsible_unit_id_organization_units_id_fk" FOREIGN KEY ("responsible_unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_responsible_account_id_user_accounts_id_fk" FOREIGN KEY ("responsible_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_created_by_account_id_user_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visit_events_visit_idx" ON "visit_events" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "visit_visitors_visit_idx" ON "visit_visitors" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "visits_scheduled_date_idx" ON "visits" USING btree ("scheduled_date");--> statement-breakpoint
CREATE INDEX "visits_status_idx" ON "visits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "visits_responsible_unit_idx" ON "visits" USING btree ("responsible_unit_id");