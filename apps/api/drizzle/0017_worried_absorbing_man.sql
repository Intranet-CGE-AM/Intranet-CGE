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
ALTER TABLE "workflow_substitutions" ADD CONSTRAINT "workflow_substitutions_original_account_id_user_accounts_id_fk" FOREIGN KEY ("original_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_substitutions" ADD CONSTRAINT "workflow_substitutions_substitute_account_id_user_accounts_id_fk" FOREIGN KEY ("substitute_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_substitutions" ADD CONSTRAINT "workflow_substitutions_unit_id_organization_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "substitution_recipient_idx" ON "workflow_substitutions" USING btree ("substitute_account_id","starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "substitution_original_idx" ON "workflow_substitutions" USING btree ("original_account_id","unit_id");