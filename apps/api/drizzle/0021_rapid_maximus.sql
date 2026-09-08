ALTER TABLE "hr_resources" ALTER COLUMN "external_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hr_resources" ADD COLUMN "object_key" text;--> statement-breakpoint
ALTER TABLE "hr_resources" ADD COLUMN "file_size" integer;--> statement-breakpoint
ALTER TABLE "hr_resources" ADD CONSTRAINT "hr_resources_source" CHECK (("hr_resources"."external_url" is not null and "hr_resources"."object_key" is null and "hr_resources"."file_size" is null) or ("hr_resources"."external_url" is null and "hr_resources"."object_key" is not null and "hr_resources"."file_size" is not null and "hr_resources"."file_size" > 0 and "hr_resources"."file_size" <= 10485760));--> statement-breakpoint
ALTER TABLE "hr_resources" ADD CONSTRAINT "hr_resources_external_link" CHECK ("hr_resources"."type" <> 'external_link' or "hr_resources"."external_url" is not null);
