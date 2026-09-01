ALTER TABLE "visit_visitors" ADD COLUMN "confirmation_status" varchar(20) DEFAULT 'not_sent' NOT NULL;--> statement-breakpoint
ALTER TABLE "visit_visitors" ADD COLUMN "confirmation_token_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "visit_visitors" ADD COLUMN "confirmation_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "visit_visitors" ADD COLUMN "confirmation_responded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "visit_visitors" ADD COLUMN "confirmation_expires_at" timestamp with time zone;