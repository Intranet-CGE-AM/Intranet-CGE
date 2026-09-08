ALTER TABLE "functional_documents" ADD COLUMN "requires_acknowledgment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "functional_documents" ADD COLUMN "acknowledged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "functional_documents" ADD COLUMN "acknowledged_by_account_id" uuid;--> statement-breakpoint
ALTER TABLE "functional_documents" ADD CONSTRAINT "functional_documents_acknowledged_by_account_id_user_accounts_id_fk" FOREIGN KEY ("acknowledged_by_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;