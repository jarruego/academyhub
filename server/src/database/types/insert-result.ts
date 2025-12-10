/**
 * Standardized insert result returned by repositories.
 * Some drivers/ORMs return { insertId }, others { insert_id } or { id } or an array.
 * This narrow type allows repository implementations to advertise a common shape
 * while keeping flexibility for additional fields.
 */
export type InsertResult = {
  insertId?: number;
  insert_id?: number;
  id?: number;
  [key: string]: unknown;
};

export default InsertResult;
