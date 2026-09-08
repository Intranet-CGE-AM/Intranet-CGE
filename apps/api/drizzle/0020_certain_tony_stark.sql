CREATE TABLE "hr_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"category" text NOT NULL,
	"responsible_name" text NOT NULL,
	"valid_from" date NOT NULL,
	"valid_until" date NOT NULL,
	"audience" jsonb NOT NULL,
	"requires_acknowledgment" boolean NOT NULL,
	"external_url" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"author_account_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_resources_type" CHECK ("hr_resources"."type" in ('policy','manual','form','external_link')),
	CONSTRAINT "hr_resources_status" CHECK ("hr_resources"."status" in ('published','superseded','archived')),
	CONSTRAINT "hr_resources_version" CHECK ("hr_resources"."version" > 0),
	CONSTRAINT "hr_resources_period" CHECK ("hr_resources"."valid_until" >= "hr_resources"."valid_from")
);
--> statement-breakpoint
ALTER TABLE "hr_resources" ADD CONSTRAINT "hr_resources_author_account_id_user_accounts_id_fk" FOREIGN KEY ("author_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hr_resources_current_idx" ON "hr_resources" USING btree ("status","valid_from","valid_until");