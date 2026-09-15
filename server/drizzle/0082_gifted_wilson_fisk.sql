CREATE TABLE "academyhub"."consulting_client_companies" (
	"id_consulting_client_company" serial PRIMARY KEY NOT NULL,
	"id_consulting_client" integer NOT NULL,
	"id_company" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academyhub"."consulting_clients" (
	"id_consulting_client" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_client_companies" ADD CONSTRAINT "consulting_client_companies_id_consulting_client_consulting_clients_id_consulting_client_fk" FOREIGN KEY ("id_consulting_client") REFERENCES "academyhub"."consulting_clients"("id_consulting_client") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_client_companies" ADD CONSTRAINT "consulting_client_companies_id_company_companies_id_company_fk" FOREIGN KEY ("id_company") REFERENCES "academyhub"."companies"("id_company") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_consulting_client_companies_id_consulting_client" ON "academyhub"."consulting_client_companies" USING btree ("id_consulting_client");--> statement-breakpoint
CREATE INDEX "idx_consulting_client_companies_id_company" ON "academyhub"."consulting_client_companies" USING btree ("id_company");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_consulting_client_companies_unique_pair" ON "academyhub"."consulting_client_companies" USING btree ("id_consulting_client","id_company");