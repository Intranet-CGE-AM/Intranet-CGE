CREATE TABLE "checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"person_name" text NOT NULL,
	"employment_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"items" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checklist_kind" CHECK ("checklists"."kind" in ('entry','exit')),
	CONSTRAINT "checklist_version" CHECK ("checklists"."version" > 0),
	CONSTRAINT "checklist_items" CHECK (jsonb_array_length("checklists"."items") between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "onboarding_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"active" boolean NOT NULL,
	"items" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "onboarding_template_kind" CHECK ("onboarding_templates"."kind" in ('entry','exit')),
	CONSTRAINT "onboarding_template_version" CHECK ("onboarding_templates"."version" > 0),
	CONSTRAINT "onboarding_template_items" CHECK (jsonb_array_length("onboarding_templates"."items") between 1 and 100)
);
--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_employment_id_employment_relationships_id_fk" FOREIGN KEY ("employment_id") REFERENCES "public"."employment_relationships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_unit_id_organization_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_template_id_onboarding_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."onboarding_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checklists_person_idx" ON "checklists" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "checklists_unit_idx" ON "checklists" USING btree ("unit_id","created_at");--> statement-breakpoint
CREATE INDEX "checklists_assignees_idx" ON "checklists" USING gin ("items");