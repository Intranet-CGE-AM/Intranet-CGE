CREATE TABLE "field_provenance" (
	"person_id" uuid NOT NULL,
	"field" text NOT NULL,
	"value" jsonb,
	"external_value" jsonb,
	"source" text NOT NULL,
	"import_run_id" uuid,
	"checksum" text,
	"synced_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "field_provenance_person_id_field_pk" PRIMARY KEY("person_id","field")
);
--> statement-breakpoint
ALTER TABLE "field_provenance" ADD CONSTRAINT "field_provenance_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_provenance" ADD CONSTRAINT "field_provenance_import_run_id_import_runs_id_fk" FOREIGN KEY ("import_run_id") REFERENCES "public"."import_runs"("id") ON DELETE no action ON UPDATE no action;