CREATE TABLE "hr_request_settings" (
	"type" text PRIMARY KEY NOT NULL,
	"days" integer NOT NULL,
	CONSTRAINT "hr_request_settings_days" CHECK ("hr_request_settings"."days" between 1 and 365),
	CONSTRAINT "hr_request_settings_type" CHECK ("hr_request_settings"."type" in ('correction','declaration','vacation_question','other'))
);
