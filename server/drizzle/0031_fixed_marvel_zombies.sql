CREATE TABLE "smtp_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"host" varchar(255) NOT NULL,
	"port" integer NOT NULL,
	"user" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"secure" boolean DEFAULT false NOT NULL,
	"from_email" varchar(255) NOT NULL,
	"from_name" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
