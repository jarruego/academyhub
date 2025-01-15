ALTER TABLE "users" RENAME TO "auth_users";--> statement-breakpoint
ALTER TABLE "auth_users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "auth_users" DROP CONSTRAINT "users_username_unique";--> statement-breakpoint
ALTER TABLE "auth_users" ADD CONSTRAINT "auth_users_email_unique" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "auth_users" ADD CONSTRAINT "auth_users_username_unique" UNIQUE("username");