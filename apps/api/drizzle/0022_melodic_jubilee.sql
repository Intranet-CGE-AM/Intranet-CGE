CREATE TABLE "hr_resource_acknowledgments" (
	"resource_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"acknowledged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_resource_acknowledgments_resource_id_account_id_pk" PRIMARY KEY("resource_id","account_id")
);
--> statement-breakpoint
ALTER TABLE "hr_resources" ADD COLUMN "root_id" uuid;--> statement-breakpoint
ALTER TABLE "hr_resource_acknowledgments" ADD CONSTRAINT "hr_resource_acknowledgments_resource_id_hr_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."hr_resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_resource_acknowledgments" ADD CONSTRAINT "hr_resource_acknowledgments_account_id_user_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_resources" ADD CONSTRAINT "hr_resources_root_id_hr_resources_id_fk" FOREIGN KEY ("root_id") REFERENCES "public"."hr_resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hr_resources_revision_unique" ON "hr_resources" USING btree ("root_id","version");--> statement-breakpoint
ALTER TABLE "hr_resources" ADD CONSTRAINT "hr_resources_root_version" CHECK (("hr_resources"."root_id" is null and "hr_resources"."version" = 1) or ("hr_resources"."root_id" is not null and "hr_resources"."version" > 1));