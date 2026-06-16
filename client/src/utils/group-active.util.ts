/**
 * Group "active" state resolution — client mirror of the server helper
 * (`server/src/utils/group-active.util.ts`). Keep both in sync.
 */

export type GroupActiveMode = 'auto' | 'active' | 'inactive';

/**
 * Grace period (in days) after a group's `end_date` during which it is still
 * considered active. Mirror of the server constant — keep both in sync.
 */
export const ACTIVE_GROUP_GRACE_DAYS = 2;

const GRACE_MS = ACTIVE_GROUP_GRACE_DAYS * 24 * 60 * 60 * 1000;

type GroupActiveInput = {
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  active_mode?: GroupActiveMode | string | null;
};

/**
 * Is the group currently active?
 *  1. active_mode = 'active'   -> true  (manual override)
 *  2. active_mode = 'inactive' -> false (manual override)
 *  3. active_mode = 'auto'     -> true only if start_date AND end_date are set
 *     and `now` is within [start_date, end_date + grace].
 */
export function isGroupActive(group: GroupActiveInput, now: Date = new Date()): boolean {
  const mode = (group.active_mode ?? 'auto') as GroupActiveMode;
  if (mode === 'active') return true;
  if (mode === 'inactive') return false;

  if (!group.start_date || !group.end_date) return false;
  const start = new Date(group.start_date).getTime();
  const end = new Date(group.end_date).getTime() + GRACE_MS;
  const t = now.getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return t >= start && t <= end;
}

export const GROUP_ACTIVE_MODE_OPTIONS: { value: GroupActiveMode; label: string }[] = [
  { value: 'auto', label: 'Automático (por fechas)' },
  { value: 'active', label: 'Forzar activo' },
  { value: 'inactive', label: 'Forzar inactivo' },
];
