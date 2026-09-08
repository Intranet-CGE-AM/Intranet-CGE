CREATE TABLE "occurrence_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"actor_account_id" uuid NOT NULL,
	"type" text NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occurrence_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"active" boolean NOT NULL,
	"requires_supervisor" boolean NOT NULL,
	"requires_rh" boolean NOT NULL,
	"requires_document" boolean NOT NULL,
	"affects_availability" boolean NOT NULL,
	"document_type_id" uuid
);
--> statement-breakpoint
CREATE TABLE "occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type_id" uuid NOT NULL,
	"type_name" text NOT NULL,
	"requires_supervisor" boolean NOT NULL,
	"requires_rh" boolean NOT NULL,
	"requires_document" boolean NOT NULL,
	"affects_availability" boolean NOT NULL,
	"document_type_id" uuid,
	"document_id" uuid,
	"requester_account_id" uuid NOT NULL,
	"requester_name" text NOT NULL,
	"employment_id" uuid NOT NULL,
	"supervisor_relationship_id" uuid,
	"unit_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"justification" text NOT NULL,
	"status" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "occurrences_dates" CHECK ("occurrences"."end_date" >= "occurrences"."start_date"),
	CONSTRAINT "occurrences_status" CHECK ("occurrences"."status" in ('draft','submitted','supervisor_approved','final_approved','rejected','cancelled')),
	CONSTRAINT "occurrences_version" CHECK ("occurrences"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "occurrence_events" ADD CONSTRAINT "occurrence_events_occurrence_id_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."occurrences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrence_events" ADD CONSTRAINT "occurrence_events_actor_account_id_user_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrence_types" ADD CONSTRAINT "occurrence_types_document_type_id_document_types_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "public"."document_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_type_id_occurrence_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."occurrence_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_document_type_id_document_types_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "public"."document_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_document_id_functional_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."functional_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_requester_account_id_user_accounts_id_fk" FOREIGN KEY ("requester_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_employment_id_employment_relationships_id_fk" FOREIGN KEY ("employment_id") REFERENCES "public"."employment_relationships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_supervisor_relationship_id_employment_relationships_id_fk" FOREIGN KEY ("supervisor_relationship_id") REFERENCES "public"."employment_relationships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_unit_id_organization_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "occurrence_events_version" ON "occurrence_events" USING btree ("occurrence_id","version");--> statement-breakpoint
CREATE INDEX "occurrences_queue_idx" ON "occurrences" USING btree ("unit_id","status");--> statement-breakpoint
CREATE INDEX "occurrences_owner_idx" ON "occurrences" USING btree ("requester_account_id","created_at");