CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"href" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "hr_requests" ADD COLUMN "information_message" text;--> statement-breakpoint
ALTER TABLE "hr_requests" ADD COLUMN "information_deadline" date;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_account_id_user_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe" ON "notifications" USING btree ("account_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notifications_account_created" ON "notifications" USING btree ("account_id","created_at");