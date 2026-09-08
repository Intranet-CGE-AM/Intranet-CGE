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
CREATE TABLE "hr_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"requester_account_id" uuid NOT NULL,
	"requester_name" text NOT NULL,
	"employment_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"assignee_account_id" uuid,
	"response" text,
	"due_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_requests_status_check" CHECK ("hr_requests"."status" in ('submitted','in_analysis','completed','rejected','cancelled')),
	CONSTRAINT "hr_requests_type_check" CHECK ("hr_requests"."type" in ('correction','declaration','vacation_question','other')),
	CONSTRAINT "hr_requests_description_check" CHECK (length("hr_requests"."description") between 10 and 2000),
	CONSTRAINT "hr_requests_version_check" CHECK ("hr_requests"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "hr_request_events" ADD CONSTRAINT "hr_request_events_request_id_hr_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."hr_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_request_events" ADD CONSTRAINT "hr_request_events_actor_account_id_user_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_requester_account_id_user_accounts_id_fk" FOREIGN KEY ("requester_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_employment_id_employment_relationships_id_fk" FOREIGN KEY ("employment_id") REFERENCES "public"."employment_relationships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_unit_id_organization_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_assignee_account_id_user_accounts_id_fk" FOREIGN KEY ("assignee_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hr_request_events_version_unique" ON "hr_request_events" USING btree ("request_id","version");--> statement-breakpoint
CREATE INDEX "hr_requests_owner_idx" ON "hr_requests" USING btree ("requester_account_id","created_at");--> statement-breakpoint
CREATE INDEX "hr_requests_queue_idx" ON "hr_requests" USING btree ("unit_id","status","due_at");