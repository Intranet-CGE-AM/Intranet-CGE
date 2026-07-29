CREATE TABLE "permission_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"permission" varchar(100) NOT NULL,
	"effect" varchar(10) NOT NULL,
	"unit_id" uuid
);
--> statement-breakpoint
ALTER TABLE "permission_overrides" ADD CONSTRAINT "permission_overrides_account_id_user_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_overrides" ADD CONSTRAINT "permission_overrides_unit_id_organization_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "permission_overrides_account_idx" ON "permission_overrides" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "permission_overrides_global_unique" ON "permission_overrides" USING btree ("account_id","permission") WHERE "permission_overrides"."unit_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "permission_overrides_unit_unique" ON "permission_overrides" USING btree ("account_id","permission","unit_id") WHERE "permission_overrides"."unit_id" is not null;