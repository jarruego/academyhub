CREATE TABLE "companies" (
	"id_company" serial PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"corporate_name" text NOT NULL,
	"cif" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_cif_unique" UNIQUE("cif")
);
