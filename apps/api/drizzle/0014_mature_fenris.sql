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
ALTER TABLE "training_events" ADD CONSTRAINT "training_events_training_id_training_records_id_fk" FOREIGN KEY ("training_id") REFERENCES "public"."training_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_events" ADD CONSTRAINT "training_events_actor_account_id_user_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_requester_account_id_user_accounts_id_fk" FOREIGN KEY ("requester_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_employment_id_employment_relationships_id_fk" FOREIGN KEY ("employment_id") REFERENCES "public"."employment_relationships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_unit_id_organization_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "training_event_version" ON "training_events" USING btree ("training_id","version");--> statement-breakpoint
CREATE INDEX "training_owner_idx" ON "training_records" USING btree ("person_id","created_at");--> statement-breakpoint
CREATE INDEX "training_queue_idx" ON "training_records" USING btree ("unit_id","status");