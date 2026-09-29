CREATE TYPE "public"."audit_document_event_type" AS ENUM('submitted', 'resubmitted', 'correction_requested', 'approved', 'cancelled', 'reopened', 'edited', 'read');--> statement-breakpoint
CREATE TYPE "public"."audit_document_file_source" AS ENUM('upload', 'editor');--> statement-breakpoint
CREATE TYPE "public"."audit_document_status" AS ENUM('in_review', 'correction_requested', 'approved', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."audit_document_uploader_role" AS ENUM('team', 'reviewer');--> statement-breakpoint
CREATE TABLE "audit_document_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"type" "audit_document_event_type" NOT NULL,
	"from_status" "audit_document_status",
	"to_status" "audit_document_status",
	"file_id" uuid,
	"message" text,
	"actor_account_id" uuid NOT NULL,
	"actor_name" text NOT NULL,
	"delegation" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_document_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"object_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"note" text,
	"source" "audit_document_file_source" DEFAULT 'upload' NOT NULL,
	"uploaded_as" "audit_document_uploader_role" DEFAULT 'team' NOT NULL,
	"uploaded_by_account_id" uuid NOT NULL,
	"uploaded_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_document_files_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "audit_document_files_number_check" CHECK ("audit_document_files"."number" > 0),
	CONSTRAINT "audit_document_files_size_check" CHECK ("audit_document_files"."size" between 1 and 20971520)
);
--> statement-breakpoint
CREATE TABLE "audit_document_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"bottleneck_rounds" integer DEFAULT 3 NOT NULL,
	CONSTRAINT "audit_document_settings_singleton" CHECK ("audit_document_settings"."id" = 1),
	CONSTRAINT "audit_document_settings_rounds" CHECK ("audit_document_settings"."bottleneck_rounds" between 1 and 20)
);
--> statement-breakpoint
CREATE TABLE "audit_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"title" text NOT NULL,
	"reference" text,
	"category" text,
	"status" "audit_document_status" DEFAULT 'in_review' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"correction_rounds" integer DEFAULT 0 NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_account_id" uuid NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_documents_title_check" CHECK (length("audit_documents"."title") between 3 and 200),
	CONSTRAINT "audit_documents_version_check" CHECK ("audit_documents"."version" > 0),
	CONSTRAINT "audit_documents_rounds_check" CHECK ("audit_documents"."correction_rounds" >= 0)
);
--> statement-breakpoint
ALTER TABLE "audit_document_events" ADD CONSTRAINT "audit_document_events_document_id_audit_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."audit_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_document_events" ADD CONSTRAINT "audit_document_events_file_id_audit_document_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."audit_document_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_document_events" ADD CONSTRAINT "audit_document_events_actor_account_id_user_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_document_files" ADD CONSTRAINT "audit_document_files_document_id_audit_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."audit_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_document_files" ADD CONSTRAINT "audit_document_files_uploaded_by_account_id_user_accounts_id_fk" FOREIGN KEY ("uploaded_by_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_documents" ADD CONSTRAINT "audit_documents_unit_id_organization_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_documents" ADD CONSTRAINT "audit_documents_created_by_account_id_user_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_document_events_document_idx" ON "audit_document_events" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_document_events_read_unique" ON "audit_document_events" USING btree ("file_id","actor_account_id") WHERE "audit_document_events"."type" = 'read';--> statement-breakpoint
CREATE UNIQUE INDEX "audit_document_files_number_unique" ON "audit_document_files" USING btree ("document_id","number");--> statement-breakpoint
CREATE INDEX "audit_documents_unit_queue_idx" ON "audit_documents" USING btree ("unit_id","status","status_changed_at");--> statement-breakpoint
CREATE INDEX "audit_documents_queue_idx" ON "audit_documents" USING btree ("status","status_changed_at");