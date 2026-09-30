CREATE TYPE "public"."technical_area" AS ENUM('sistemas', 'redes', 'manutencao');--> statement-breakpoint
CREATE TYPE "public"."ticket_approval_status" AS ENUM('not_required', 'pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'viewed', 'en_route', 'in_service', 'completed', 'cancelled', 'paused', 'maintenance');--> statement-breakpoint
CREATE TABLE "ticket_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"unit_id" uuid,
	"approver_account_id" uuid,
	"is_atec_approval" boolean DEFAULT false NOT NULL,
	"status" "ticket_approval_status" DEFAULT 'pending' NOT NULL,
	"note" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(60) NOT NULL,
	"name" varchar(160) NOT NULL,
	"icon" varchar(80),
	"color" varchar(60),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"allows_free_text" boolean DEFAULT false NOT NULL,
	"allows_beneficiary" boolean DEFAULT true NOT NULL,
	"n1_tips" text,
	"sla_hours" integer,
	"default_priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_counters" (
	"date" varchar(10) PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"actor_account_id" uuid,
	"from_status" "ticket_status",
	"to_status" "ticket_status" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_feedbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"technician_account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_account_id" uuid,
	"from_user" boolean DEFAULT false NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_subcategories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"name" varchar(180) NOT NULL,
	"code" varchar(80),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"sla_hours" integer,
	"n1_tips" text,
	"default_priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
	"area_responsavel" "technical_area",
	"requires_approval" boolean DEFAULT false NOT NULL,
	"dual_approval" boolean DEFAULT false NOT NULL,
	"requires_presential" boolean DEFAULT true NOT NULL,
	"requires_cause_solution" boolean DEFAULT true NOT NULL,
	"allows_free_text" boolean DEFAULT false NOT NULL,
	"free_text_label" varchar(160),
	"form_type" varchar(80),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" varchar(30) NOT NULL,
	"track_token" varchar(64) NOT NULL,
	"requester_account_id" uuid NOT NULL,
	"requester_person_id" uuid NOT NULL,
	"requester_name" varchar(180) NOT NULL,
	"requester_email" varchar(254),
	"requester_employee_number" varchar(50),
	"beneficiary_name" varchar(180),
	"beneficiary_employee_number" varchar(50),
	"beneficiary_email" varchar(254),
	"beneficiary_dept" varchar(160),
	"unit_id" uuid,
	"category_id" uuid NOT NULL,
	"subcategory_id" uuid,
	"free_text_description" text,
	"anydesk_code" varchar(30),
	"extra_data" jsonb,
	"priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
	"area_responsavel" "technical_area",
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"approval_status" "ticket_approval_status" DEFAULT 'not_required' NOT NULL,
	"assigned_tech_account_id" uuid,
	"presential" boolean DEFAULT true NOT NULL,
	"requires_cause_solution" boolean DEFAULT true NOT NULL,
	"cause" text,
	"solution" text,
	"completion_note" text,
	"cancel_note" text,
	"pause_note" text,
	"paused_at" timestamp with time zone,
	"total_paused_ms" integer DEFAULT 0 NOT NULL,
	"sla_deadline" timestamp with time zone,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"viewed_at" timestamp with time zone,
	"en_route_at" timestamp with time zone,
	"in_service_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"reopened_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ticket_approvals" ADD CONSTRAINT "ticket_approvals_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_approvals" ADD CONSTRAINT "ticket_approvals_unit_id_organization_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_approvals" ADD CONSTRAINT "ticket_approvals_approver_account_id_user_accounts_id_fk" FOREIGN KEY ("approver_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_actor_account_id_user_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_feedbacks" ADD CONSTRAINT "ticket_feedbacks_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_feedbacks" ADD CONSTRAINT "ticket_feedbacks_technician_account_id_user_accounts_id_fk" FOREIGN KEY ("technician_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_author_account_id_user_accounts_id_fk" FOREIGN KEY ("author_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_subcategories" ADD CONSTRAINT "ticket_subcategories_category_id_ticket_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."ticket_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requester_account_id_user_accounts_id_fk" FOREIGN KEY ("requester_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requester_person_id_people_id_fk" FOREIGN KEY ("requester_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_unit_id_organization_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_category_id_ticket_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."ticket_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_subcategory_id_ticket_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."ticket_subcategories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_tech_account_id_user_accounts_id_fk" FOREIGN KEY ("assigned_tech_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ticket_approvals_ticket_idx" ON "ticket_approvals" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_approvals_unit_status_idx" ON "ticket_approvals" USING btree ("unit_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_categories_code_unique" ON "ticket_categories" USING btree ("code");--> statement-breakpoint
CREATE INDEX "ticket_categories_active_sort_idx" ON "ticket_categories" USING btree ("active","sort_order");--> statement-breakpoint
CREATE INDEX "ticket_events_ticket_idx" ON "ticket_events" USING btree ("ticket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_feedbacks_ticket_unique" ON "ticket_feedbacks" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_feedbacks_technician_idx" ON "ticket_feedbacks" USING btree ("technician_account_id");--> statement-breakpoint
CREATE INDEX "ticket_messages_ticket_idx" ON "ticket_messages" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_subcategories_category_idx" ON "ticket_subcategories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "ticket_subcategories_active_sort_idx" ON "ticket_subcategories" USING btree ("active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_subcategories_code_unique" ON "ticket_subcategories" USING btree ("code") WHERE "ticket_subcategories"."code" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_number_unique" ON "tickets" USING btree ("ticket_number");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_track_token_unique" ON "tickets" USING btree ("track_token");--> statement-breakpoint
CREATE INDEX "tickets_requester_idx" ON "tickets" USING btree ("requester_account_id");--> statement-breakpoint
CREATE INDEX "tickets_status_idx" ON "tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tickets_approval_status_idx" ON "tickets" USING btree ("approval_status");--> statement-breakpoint
CREATE INDEX "tickets_assigned_tech_idx" ON "tickets" USING btree ("assigned_tech_account_id");--> statement-breakpoint
CREATE INDEX "tickets_unit_idx" ON "tickets" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "tickets_category_idx" ON "tickets" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "tickets_opened_at_idx" ON "tickets" USING btree ("opened_at");