-- Drop orphan column: existed in production but was never part of the Drizzle
-- schema/migration history (drift, likely added manually before the
-- moodle_user_auth_user bridge table replaced per-account tokens). Unused by
-- any code path.
ALTER TABLE "academyhub"."moodle_users" DROP COLUMN IF EXISTS "moodle_token";