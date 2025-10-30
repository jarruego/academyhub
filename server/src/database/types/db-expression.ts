import { eq, ilike, and, or, sql } from 'drizzle-orm';

// Union type for common Drizzle expression results used to build WHERE conditions.
// We use ReturnType<typeof ...> to keep it resilient to internal types.
export type DbCondition =
  | ReturnType<typeof sql>
  | ReturnType<typeof ilike>
  | ReturnType<typeof eq>
  | ReturnType<typeof or>
  | ReturnType<typeof and>;
