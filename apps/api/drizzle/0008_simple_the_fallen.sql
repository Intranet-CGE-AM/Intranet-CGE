CREATE TABLE "document_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"purpose" text NOT NULL,
	"policy_reference" text NOT NULL,
	"retention_days" integer NOT NULL,
	"sensitive" boolean NOT NULL,
	CONSTRAINT "document_type_retention" CHECK ("document_types"."retention_days" between 1 and 36500)
);
--> statement-breakpoint
CREATE TABLE "functional_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"type_id" uuid NOT NULL,
	"type_name" text NOT NULL,
	"title" text NOT NULL,
	"issued_on" date NOT NULL,
	"valid_until" date,
	"source" text NOT NULL,
	"purpose" text NOT NULL,
	"policy_reference" text NOT NULL,
	"retention_days" integer NOT NULL,
	"retained_until" timestamp with time zone NOT NULL,
	"sensitive" boolean NOT NULL,
	"object_key" text NOT NULL,
	"mime" text DEFAULT 'application/pdf' NOT NULL,
	"size" integer NOT NULL,
	"author_account_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "functional_documents_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "functional_documents_size" CHECK ("functional_documents"."size" between 1 and 5242880)
);
--> statement-breakpoint
ALTER TABLE "functional_documents" ADD CONSTRAINT "functional_documents_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "functional_documents" ADD CONSTRAINT "functional_documents_unit_id_organization_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."organization_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "functional_documents" ADD CONSTRAINT "functional_documents_type_id_document_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."document_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "functional_documents" ADD CONSTRAINT "functional_documents_author_account_id_user_accounts_id_fk" FOREIGN KEY ("author_account_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "functional_documents_owner" ON "functional_documents" USING btree ("person_id","created_at");