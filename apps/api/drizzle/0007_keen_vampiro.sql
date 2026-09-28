CREATE TYPE "public"."organization_unit_type" AS ENUM('department', 'sector', 'subsector');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('active', 'maintenance', 'disposed');--> statement-breakpoint
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
CREATE TABLE "asset_disposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"disposal_date" date NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"from_unit_id" uuid,
	"to_unit_id" uuid NOT NULL,
	"movement_date" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "hr_request_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"actor_account_id" uuid NOT NULL,
	"actor_name" text NOT NULL,
	"type" text NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_request_settings" (
	"type" text PRIMARY KEY NOT NULL,
	"days" integer NOT NULL,
	CONSTRAINT "hr_request_settings_days" CHECK ("hr_request_settings"."days" between 1 and 365),
	CONSTRAINT "hr_request_settings_type" CHECK ("hr_request_settings"."type" in ('correction','declaration','vacation_question','other'))
);
--> statement-breakpoint
CREATE TABLE "hr_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"correction" jsonb,
	"status" text DEFAULT 'submitted' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"requester_account_id" uuid NOT NULL,
	"requester_name" text NOT NULL,
	"employment_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"assignee_account_id" uuid,
	"response" text,
	"information_message" text,
	"information_deadline" date,
	"due_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_requests_status_check" CHECK ("hr_requests"."status" in ('submitted','in_analysis','completed','rejected','cancelled')),
	CONSTRAINT "hr_requests_type_check" CHECK ("hr_requests"."type" in ('correction','declaration','vacation_question','other')),
	CONSTRAINT "hr_requests_description_check" CHECK (length("hr_requests"."description") between 10 and 2000),
	CONSTRAINT "hr_requests_version_check" CHECK ("hr_requests"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text DEFAULT 'Consulte o andamento na intranet.' NOT NULL,
	"href" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "document_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"purpose" text NOT NULL,
	"policy_reference" text NOT NULL,
	"retention_days" integer NOT NULL,
	"sensitive" boolean NOT NULL,
	CONSTRAINT "document_type_retention" CHECK ("document_types"."retention_days" between 1 and 36500)
);
--> statement-breakpoint
CREATE TABLE "functional_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"type_id" uuid NOT NULL,
	"type_name" text NOT NULL,
	"title" text NOT NULL,
	"issued_on" date NOT NULL,
	"valid_until" date,
	"source" text NOT NULL,
	"purpose" text NOT NULL,
	"policy_reference" text NOT NULL,
	"retention_days" integer NOT NULL,
	"retained_until" timestamp with time zone NOT NULL,
	"sensitive" boolean NOT NULL,
	"object_key" text NOT NULL,
	"mime" text DEFAULT 'application/pdf' NOT NULL,
	"size" integer NOT NULL,
	"author_account_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"requires_acknowledgment" boolean DEFAULT false NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by_account_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "functional_documents_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "functional_documents_size" CHECK ("functional_documents"."size" between 1 and 5242880)
);
--> statement-breakpoint
CREATE TABLE "employment_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employment_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"type" text NOT NULL,
	"previous" text,
	"next" text,
	"effective_on" date NOT NULL,
	"reason" text NOT NULL,
	"actor_account_id" uuid,
	"source" text NOT NULL,
	"import_run_id" uuid,
	"checksum" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_provenance" (
	"person_id" uuid NOT NULL,
	"field" text NOT NULL,
	"value" jsonb,
	"external_value" jsonb,
	"source" text NOT NULL,
	"import_run_id" uuid,
	"checksum" text,
	"synced_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "field_provenance_person_id_field_pk" PRIMARY KEY("person_id","field")
);
--> statement-breakpoint
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
CREATE TABLE "training_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"training_id" uuid NOT NULL,
	"actor_account_id" uuid NOT NULL,
	"actor_name" text NOT NULL,
	"type" text NOT NULL,
	"reason" text,
	"version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certificate_id" uuid,
	"title" text NOT NULL,
	"institution" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"hours" numeric(8, 2) NOT NULL,
	"person_id" uuid NOT NULL,
	"requester_account_id" uuid NOT NULL,
	"requester_name" text NOT NULL,
	"employment_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_dates" CHECK ("training_records"."end_date" >= "training_records"."start_date"),
	CONSTRAINT "training_hours" CHECK ("training_records"."hours" > 0),
	CONSTRAINT "training_status" CHECK ("training_records"."status" in ('submitted','validated','rejected','archived')),
	CONSTRAINT "training_version" CHECK ("training_records"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "training_settings" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"certificate_type_id" uuid,
	CONSTRAINT "training_settings_singleton" CHECK ("training_settings"."id" = true)
);
--> statement-breakpoint
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
CREATE TABLE "workflow_substitutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_account_id" uuid NOT NULL,
	"substitute_account_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"reason" text NOT NULL,
	"flows" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "substitution_dates" CHECK ("workflow_substitutions"."ends_on" >= "workflow_substitutions"."starts_on"),
	CONSTRAINT "substitution_distinct_accounts" CHECK ("workflow_substitutions"."original_account_id" <> "workflow_substitutions"."substitute_account_id"),
	CONSTRAINT "substitution_flows" CHECK (jsonb_array_length("workflow_substitutions"."flows") > 0),
	CONSTRAINT "substitution_version" CHECK ("workflow_substitutions"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "hr_communication_acknowledgments" (
	"communication_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"acknowledged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_communication_acknowledgments_communication_id_account_id_version_pk" PRIMARY KEY("communication_id","account_id","version")
);
--> statement-breakpoint
CREATE TABLE "hr_communications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body" text NOT NULL,
	"publication_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"audience" jsonb NOT NULL,
	"requires_acknowledgment" boolean NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"author_account_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_communication_status" CHECK ("hr_communications"."status" in ('draft','scheduled','published','archived')),
	CONSTRAINT "hr_communication_version" CHECK ("hr_communications"."version" > 0),
	CONSTRAINT "hr_communication_period" CHECK ("hr_communications"."expires_at" > "hr_communications"."publication_at")
);
--> statement-breakpoint
CREATE TABLE "hr_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"root_id" uuid,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"category" text NOT NULL,
	"responsible_name" text NOT NULL,
	"valid_from" date NOT NULL,
	"valid_until" date NOT NULL,
	"audience" jsonb NOT NULL,
	"requires_acknowledgment" boolean NOT NULL,
	"external_url" text,
	"object_key" text,
	"file_size" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"author_account_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_resources_type" CHECK ("hr_resources"."type" in ('policy','manual','form','external_link')),
	CONSTRAINT "hr_resources_status" CHECK ("hr_resources"."status" in ('published','superseded','archived')),
	CONSTRAINT "hr_resources_version" CHECK ("hr_resources"."version" > 0),
	CONSTRAINT "hr_resources_root_version" CHECK (("hr_resources"."root_id" is null and "hr_resources"."version" = 1) or ("hr_resources"."root_id" is not null and "hr_resources"."version" > 1)),
	CONSTRAINT "hr_resources_source" CHECK (("hr_resources"."external_url" is not null and "hr_resources"."object_key" is null and "hr_resources"."file_size" is null) or ("hr_resources"."external_url" is null and "hr_resources"."object_key" is not null and "hr_resources"."file_size" is not null and "hr_resources"."file_size" > 0 and "hr_resources"."file_size" <= 10485760)),
	CONSTRAINT "hr_resources_external_link" CHECK ("hr_resources"."type" <> 'external_link' or "hr_resources"."external_url" is not null),
	CONSTRAINT "hr_resources_period" CHECK ("hr_resources"."valid_until" >= "hr_resources"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "hr_resource_acknowledgments" (
	"resource_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"acknowledged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_resource_acknowledgments_resource_id_account_id_pk" PRIMARY KEY("resource_id","account_id")
);
--> statement-breakpoint
ALTER TABLE "import_runs" ADD COLUMN "preview" jsonb;--> statement-breakpoint
ALTER TABLE "employment_relationships" ADD COLUMN "position_id" uuid;--> statement-breakpoint
ALTER TABLE "employment_relationships" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_units" ADD COLUMN "type" "organization_unit_type";--> statement-breakpoint
ALTER TABLE "organization_positions" ADD CONSTRAINT "organization_positions_unit_id_organization_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_disposals" ADD CONSTRAINT "asset_disposals_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_from_unit_id_organization_units_id_fk" FOREIGN KEY ("from_unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_to_unit_id_organization_units_id_fk" FOREIGN KEY ("to_unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_unit_id_organization_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_responsible_person_id_people_id_fk" FOREIGN KEY ("responsible_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_request_events" ADD CONSTRAINT "hr_request_events_request_id_hr_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."hr_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_request_events" ADD CONSTRAINT "hr_request_events_actor_account_id_user_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_requester_account_id_user_accounts_id_fk" FOREIGN KEY ("requester_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_employment_id_employment_relationships_id_fk" FOREIGN KEY ("employment_id") REFERENCES "public"."employment_relationships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_unit_id_organization_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_assignee_account_id_user_accounts_id_fk" FOREIGN KEY ("assignee_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_account_id_user_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "functional_documents" ADD CONSTRAINT "functional_documents_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "functional_documents" ADD CONSTRAINT "functional_documents_unit_id_organization_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "functional_documents" ADD CONSTRAINT "functional_documents_type_id_document_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."document_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "functional_documents" ADD CONSTRAINT "functional_documents_author_account_id_user_accounts_id_fk" FOREIGN KEY ("author_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "functional_documents" ADD CONSTRAINT "functional_documents_acknowledged_by_account_id_user_accounts_id_fk" FOREIGN KEY ("acknowledged_by_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_movements" ADD CONSTRAINT "employment_movements_employment_id_employment_relationships_id_fk" FOREIGN KEY ("employment_id") REFERENCES "public"."employment_relationships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_movements" ADD CONSTRAINT "employment_movements_actor_account_id_user_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_movements" ADD CONSTRAINT "employment_movements_import_run_id_import_runs_id_fk" FOREIGN KEY ("import_run_id") REFERENCES "public"."import_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_provenance" ADD CONSTRAINT "field_provenance_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_provenance" ADD CONSTRAINT "field_provenance_import_run_id_import_runs_id_fk" FOREIGN KEY ("import_run_id") REFERENCES "public"."import_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "training_events" ADD CONSTRAINT "training_events_training_id_training_records_id_fk" FOREIGN KEY ("training_id") REFERENCES "public"."training_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_events" ADD CONSTRAINT "training_events_actor_account_id_user_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_certificate_id_functional_documents_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."functional_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_requester_account_id_user_accounts_id_fk" FOREIGN KEY ("requester_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_employment_id_employment_relationships_id_fk" FOREIGN KEY ("employment_id") REFERENCES "public"."employment_relationships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_unit_id_organization_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_settings" ADD CONSTRAINT "training_settings_certificate_type_id_document_types_id_fk" FOREIGN KEY ("certificate_type_id") REFERENCES "public"."document_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_employment_id_employment_relationships_id_fk" FOREIGN KEY ("employment_id") REFERENCES "public"."employment_relationships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_unit_id_organization_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_template_id_onboarding_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."onboarding_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_substitutions" ADD CONSTRAINT "workflow_substitutions_original_account_id_user_accounts_id_fk" FOREIGN KEY ("original_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_substitutions" ADD CONSTRAINT "workflow_substitutions_substitute_account_id_user_accounts_id_fk" FOREIGN KEY ("substitute_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_substitutions" ADD CONSTRAINT "workflow_substitutions_unit_id_organization_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_communication_acknowledgments" ADD CONSTRAINT "hr_communication_acknowledgments_communication_id_hr_communications_id_fk" FOREIGN KEY ("communication_id") REFERENCES "public"."hr_communications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_communication_acknowledgments" ADD CONSTRAINT "hr_communication_acknowledgments_account_id_user_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_communications" ADD CONSTRAINT "hr_communications_author_account_id_user_accounts_id_fk" FOREIGN KEY ("author_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_resources" ADD CONSTRAINT "hr_resources_root_id_hr_resources_id_fk" FOREIGN KEY ("root_id") REFERENCES "public"."hr_resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_resources" ADD CONSTRAINT "hr_resources_author_account_id_user_accounts_id_fk" FOREIGN KEY ("author_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_resource_acknowledgments" ADD CONSTRAINT "hr_resource_acknowledgments_resource_id_hr_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."hr_resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_resource_acknowledgments" ADD CONSTRAINT "hr_resource_acknowledgments_account_id_user_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_positions_unit_code_unique" ON "organization_positions" USING btree ("unit_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_positions_id_unit_unique" ON "organization_positions" USING btree ("id","unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hr_request_events_version_unique" ON "hr_request_events" USING btree ("request_id","version");--> statement-breakpoint
CREATE INDEX "hr_requests_owner_idx" ON "hr_requests" USING btree ("requester_account_id","created_at");--> statement-breakpoint
CREATE INDEX "hr_requests_queue_idx" ON "hr_requests" USING btree ("unit_id","status","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe" ON "notifications" USING btree ("account_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notifications_account_created" ON "notifications" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "functional_documents_owner" ON "functional_documents" USING btree ("person_id","created_at");--> statement-breakpoint
CREATE INDEX "employment_movements_employment_idx" ON "employment_movements" USING btree ("employment_id","effective_on");--> statement-breakpoint
CREATE UNIQUE INDEX "employment_movements_version_field_unique" ON "employment_movements" USING btree ("employment_id","version","type");--> statement-breakpoint
CREATE UNIQUE INDEX "occurrence_events_version" ON "occurrence_events" USING btree ("occurrence_id","version");--> statement-breakpoint
CREATE INDEX "occurrences_queue_idx" ON "occurrences" USING btree ("unit_id","status");--> statement-breakpoint
CREATE INDEX "occurrences_owner_idx" ON "occurrences" USING btree ("requester_account_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "training_event_version" ON "training_events" USING btree ("training_id","version");--> statement-breakpoint
CREATE INDEX "training_owner_idx" ON "training_records" USING btree ("person_id","created_at");--> statement-breakpoint
CREATE INDEX "training_queue_idx" ON "training_records" USING btree ("unit_id","status");--> statement-breakpoint
CREATE INDEX "checklists_person_idx" ON "checklists" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "checklists_unit_idx" ON "checklists" USING btree ("unit_id","created_at");--> statement-breakpoint
CREATE INDEX "checklists_assignees_idx" ON "checklists" USING gin ("items");--> statement-breakpoint
CREATE INDEX "substitution_recipient_idx" ON "workflow_substitutions" USING btree ("substitute_account_id","starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "substitution_original_idx" ON "workflow_substitutions" USING btree ("original_account_id","unit_id");--> statement-breakpoint
CREATE INDEX "hr_communications_publication_idx" ON "hr_communications" USING btree ("status","publication_at","expires_at");--> statement-breakpoint
CREATE INDEX "hr_resources_current_idx" ON "hr_resources" USING btree ("status","valid_from","valid_until");--> statement-breakpoint
CREATE UNIQUE INDEX "hr_resources_revision_unique" ON "hr_resources" USING btree ("root_id","version");--> statement-breakpoint
ALTER TABLE "employment_relationships" ADD CONSTRAINT "employment_position_same_unit_fk" FOREIGN KEY ("position_id","unit_id") REFERENCES "public"."organization_positions"("id","unit_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employment_relationships_position_idx" ON "employment_relationships" USING btree ("position_id");