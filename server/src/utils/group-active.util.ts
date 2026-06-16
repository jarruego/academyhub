import { sql, SQL } from 'drizzle-orm';
import { groupTable } from 'src/database/schema/tables/group.table';

/**
 * Grace period (in days) added after a group's `end_date` during which the
 * group is still considered active (so late progress can still be synced).
 *
 * Kept as a code constant on purpose (no env var). Mirror of the client
 * constant in `client/src/utils/group-active.util.ts` — keep both in sync.
 */
export const ACTIVE_GROUP_GRACE_DAYS = 2;

/**
 * SQL boolean expression: is this group currently active?
 *
 * Resolution order (mirror of the client `isGroupActive`):
 *  1. active_mode = 'active'   -> true  (manual override)
 *  2. active_mode = 'inactive' -> false (manual override)
 *  3. active_mode = 'auto'     -> true only if start_date AND end_date are set
 *     and NOW() is within [start_date, end_date + grace].
 *
 * Requires `groupTable` to be in scope of the query (FROM or a subquery).
 */
export function groupActiveCondition(): SQL<boolean> {
  return sql<boolean>`(
    CASE
      WHEN ${groupTable.active_mode} = 'active' THEN true
      WHEN ${groupTable.active_mode} = 'inactive' THEN false
      WHEN ${groupTable.start_date} IS NOT NULL
        AND ${groupTable.end_date} IS NOT NULL
        AND NOW() >= ${groupTable.start_date}
        AND NOW() <= (${groupTable.end_date} + (${ACTIVE_GROUP_GRACE_DAYS} * INTERVAL '1 day'))
      THEN true
      ELSE false
    END
  )`;
}
