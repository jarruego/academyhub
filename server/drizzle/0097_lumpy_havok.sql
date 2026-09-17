CREATE TABLE "academyhub"."consulting_center_tokens" (
	"id_center" integer PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	"revoked_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_center_tokens" ADD CONSTRAINT "consulting_center_tokens_id_center_centers_id_center_fk" FOREIGN KEY ("id_center") REFERENCES "academyhub"."centers"("id_center") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_consulting_center_tokens_unique_token_hash" ON "academyhub"."consulting_center_tokens" USING btree ("token_hash");