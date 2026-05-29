CREATE TABLE "revoked_tokens" (
	"jti" varchar(36) PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL
);
