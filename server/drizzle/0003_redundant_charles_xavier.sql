CREATE TABLE "centers" (
	"id_center" serial PRIMARY KEY NOT NULL,
	"center_name" varchar(128) NOT NULL,
	"employer_number" varchar(128) NOT NULL,
	"id_company" integer NOT NULL,
	"contact_person" varchar(64) NOT NULL,
	"contact_phone" varchar(32) NOT NULL,
	"contact_email" varchar(128) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "centers" ADD CONSTRAINT "centers_id_company_companies_id_company_fk" FOREIGN KEY ("id_company") REFERENCES "public"."companies"("id_company") ON DELETE no action ON UPDATE no action;