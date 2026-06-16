/**
 * Manual override for a group's "active" state.
 * - AUTO: derive from the date window (start_date/end_date + grace). Default.
 * - ACTIVE: force the group as active regardless of dates.
 * - INACTIVE: force the group as inactive regardless of dates.
 *
 * The resolved active state (override + date window) is shared between the
 * server SQL helper (`utils/group-active.util.ts`) and the client helper
 * (`client/src/utils/group-active.util.ts`); keep both in sync.
 */
export enum GroupActiveMode {
  AUTO = 'auto',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}
