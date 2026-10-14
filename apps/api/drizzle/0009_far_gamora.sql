ALTER TABLE "user_accounts" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_accounts" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_accounts" ADD COLUMN "auth_provider" varchar(10) DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_accounts" ADD COLUMN "directory_id" varchar(253);--> statement-breakpoint
ALTER TABLE "user_accounts" ADD COLUMN "directory_guid" uuid;--> statement-breakpoint
ALTER TABLE "user_accounts" ADD COLUMN "directory_upn" varchar(254);--> statement-breakpoint
ALTER TABLE "user_accounts" ADD COLUMN "directory_sam" varchar(256);--> statement-breakpoint
ALTER TABLE "user_accounts" ADD COLUMN "directory_checked_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "user_accounts_directory_identity_unique" ON "user_accounts" USING btree ("directory_id","directory_guid");--> statement-breakpoint
CREATE UNIQUE INDEX "user_accounts_directory_upn_unique" ON "user_accounts" USING btree ("directory_id",lower("directory_upn"));--> statement-breakpoint
CREATE UNIQUE INDEX "user_accounts_directory_sam_unique" ON "user_accounts" USING btree ("directory_id",lower("directory_sam"));--> statement-breakpoint
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_auth_provider_check" CHECK (("user_accounts"."auth_provider" = 'local' AND "user_accounts"."email" IS NOT NULL AND "user_accounts"."password_hash" IS NOT NULL AND "user_accounts"."directory_guid" IS NULL AND "user_accounts"."directory_id" IS NULL AND "user_accounts"."directory_upn" IS NULL AND "user_accounts"."directory_sam" IS NULL) OR ("user_accounts"."auth_provider" = 'ad' AND "user_accounts"."password_hash" IS NULL AND "user_accounts"."directory_id" IS NOT NULL AND "user_accounts"."directory_guid" IS NOT NULL AND "user_accounts"."directory_upn" IS NOT NULL AND "user_accounts"."directory_sam" IS NOT NULL AND "user_accounts"."force_password_change_at" IS NULL));