CREATE TYPE "public"."account_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('previewed', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."vacation_status" AS ENUM('draft', 'submitted', 'supervisor_approved', 'supervisor_rejected', 'final_approved', 'final_rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"unit_id" uuid
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission" varchar(100) NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_pk" PRIMARY KEY("role_id","permission")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(240)
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_account_id" uuid,
	"action" varchar(120) NOT NULL,
	"object_type" varchar(80) NOT NULL,
	"object_id" uuid,
	"outcome" varchar(40) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"account_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"force_password_change_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_run_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"field" varchar(100),
	"message" text NOT NULL,
	"row_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"status" "import_status" DEFAULT 'previewed' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"successful_rows" integer DEFAULT 0 NOT NULL,
	"failed_rows" integer DEFAULT 0 NOT NULL,
	"created_by_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "employment_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"vacation_eligible" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employment_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"supervisor_relationship_id" uuid,
	"start_date" date NOT NULL,
	"end_date" date,
	"job_title" varchar(160),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employment_relationships_valid_dates" CHECK ("employment_relationships"."end_date" is null or "employment_relationships"."end_date" >= "employment_relationships"."start_date")
);
--> statement-breakpoint
CREATE TABLE "organization_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(160) NOT NULL,
	"parent_id" uuid,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(180) NOT NULL,
	"preferred_name" varchar(120),
	"birth_date" date,
	"birthday_visible" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vacation_request_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vacation_request_id" uuid NOT NULL,
	"actor_account_id" uuid NOT NULL,
	"type" text NOT NULL,
	"comment" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vacation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employment_relationship_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "vacation_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vacation_requests_valid_dates" CHECK ("vacation_requests"."end_date" >= "vacation_requests"."start_date"),
	CONSTRAINT "vacation_requests_positive_version" CHECK ("vacation_requests"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_account_id_user_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_unit_id_organization_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_account_id_user_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_user_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_errors" ADD CONSTRAINT "import_errors_import_run_id_import_runs_id_fk" FOREIGN KEY ("import_run_id") REFERENCES "public"."import_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_created_by_account_id_user_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_relationships" ADD CONSTRAINT "employment_relationships_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_relationships" ADD CONSTRAINT "employment_relationships_category_id_employment_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."employment_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_relationships" ADD CONSTRAINT "employment_relationships_unit_id_organization_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_relationships" ADD CONSTRAINT "employment_relationships_supervisor_relationship_id_employment_relationships_id_fk" FOREIGN KEY ("supervisor_relationship_id") REFERENCES "public"."employment_relationships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_units" ADD CONSTRAINT "organization_units_parent_id_organization_units_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacation_request_events" ADD CONSTRAINT "vacation_request_events_vacation_request_id_vacation_requests_id_fk" FOREIGN KEY ("vacation_request_id") REFERENCES "public"."vacation_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacation_request_events" ADD CONSTRAINT "vacation_request_events_actor_account_id_user_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacation_requests" ADD CONSTRAINT "vacation_requests_employment_relationship_id_employment_relationships_id_fk" FOREIGN KEY ("employment_relationship_id") REFERENCES "public"."employment_relationships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "role_assignments_account_idx" ON "role_assignments" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "role_assignments_unit_idx" ON "role_assignments" USING btree ("unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_assignments_global_unique" ON "role_assignments" USING btree ("account_id","role_id") WHERE "role_assignments"."unit_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "role_assignments_unit_unique" ON "role_assignments" USING btree ("account_id","role_id","unit_id") WHERE "role_assignments"."unit_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_unique" ON "roles" USING btree ("name");--> statement-breakpoint
CREATE INDEX "audit_events_created_at_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_account_id");--> statement-breakpoint
CREATE INDEX "audit_events_object_idx" ON "audit_events" USING btree ("object_type","object_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_account_idx" ON "sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_accounts_person_unique" ON "user_accounts" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_accounts_email_unique" ON "user_accounts" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "import_errors_run_idx" ON "import_errors" USING btree ("import_run_id");--> statement-breakpoint
CREATE INDEX "import_runs_created_at_idx" ON "import_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "import_runs_checksum_idx" ON "import_runs" USING btree ("checksum");--> statement-breakpoint
CREATE UNIQUE INDEX "employment_categories_name_unique" ON "employment_categories" USING btree ("name");--> statement-breakpoint
CREATE INDEX "employment_relationships_person_idx" ON "employment_relationships" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "employment_relationships_unit_idx" ON "employment_relationships" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "employment_relationships_supervisor_idx" ON "employment_relationships" USING btree ("supervisor_relationship_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employment_relationships_one_active_per_person" ON "employment_relationships" USING btree ("person_id") WHERE "employment_relationships"."end_date" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_units_code_unique" ON "organization_units" USING btree ("code");--> statement-breakpoint
CREATE INDEX "organization_units_parent_idx" ON "organization_units" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "people_full_name_idx" ON "people" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "vacation_request_events_request_idx" ON "vacation_request_events" USING btree ("vacation_request_id");--> statement-breakpoint
CREATE INDEX "vacation_requests_employment_idx" ON "vacation_requests" USING btree ("employment_relationship_id");--> statement-breakpoint
CREATE INDEX "vacation_requests_status_idx" ON "vacation_requests" USING btree ("status");