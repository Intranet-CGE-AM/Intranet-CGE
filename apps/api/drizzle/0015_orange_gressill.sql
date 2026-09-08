CREATE TABLE "training_settings" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"certificate_type_id" uuid,
	CONSTRAINT "training_settings_singleton" CHECK ("training_settings"."id" = true)
);
--> statement-breakpoint
ALTER TABLE "training_records" ADD COLUMN "certificate_id" uuid;--> statement-breakpoint
ALTER TABLE "training_settings" ADD CONSTRAINT "training_settings_certificate_type_id_document_types_id_fk" FOREIGN KEY ("certificate_type_id") REFERENCES "public"."document_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_certificate_id_functional_documents_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."functional_documents"("id") ON DELETE no action ON UPDATE no action;