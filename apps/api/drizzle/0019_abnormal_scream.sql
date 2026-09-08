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
ALTER TABLE "hr_communication_acknowledgments" ADD CONSTRAINT "hr_communication_acknowledgments_communication_id_hr_communications_id_fk" FOREIGN KEY ("communication_id") REFERENCES "public"."hr_communications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_communication_acknowledgments" ADD CONSTRAINT "hr_communication_acknowledgments_account_id_user_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_communications" ADD CONSTRAINT "hr_communications_author_account_id_user_accounts_id_fk" FOREIGN KEY ("author_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hr_communications_publication_idx" ON "hr_communications" USING btree ("status","publication_at","expires_at");