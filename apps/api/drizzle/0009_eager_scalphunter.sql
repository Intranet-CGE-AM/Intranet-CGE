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
ALTER TABLE "employment_relationships" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "employment_movements" ADD CONSTRAINT "employment_movements_employment_id_employment_relationships_id_fk" FOREIGN KEY ("employment_id") REFERENCES "public"."employment_relationships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_movements" ADD CONSTRAINT "employment_movements_actor_account_id_user_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_movements" ADD CONSTRAINT "employment_movements_import_run_id_import_runs_id_fk" FOREIGN KEY ("import_run_id") REFERENCES "public"."import_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employment_movements_employment_idx" ON "employment_movements" USING btree ("employment_id","effective_on");--> statement-breakpoint
CREATE UNIQUE INDEX "employment_movements_version_field_unique" ON "employment_movements" USING btree ("employment_id","version","type");