/**
 * Utilities for dealing with database repository results whose shape may vary
 * depending on the driver/implementation.
 */
export function getNumericId(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return v as number;
  if (typeof v === 'string') {
    const m = v.match(/^\d+$/);
    if (m) return parseInt(v, 10);
  }
  return undefined;
}

export function resolveInsertId(created: unknown): number | undefined {
  // If created is an array (e.g. [{ id: 123 }]) try the first element
  if (Array.isArray(created) && created.length > 0) {
    const maybe = created[0];
    if (maybe && typeof maybe === 'object') {
      const r = maybe as Record<string, unknown>;
      return getNumericId(r.id ?? r.id_course ?? r.insertId ?? r.insert_id);
    }
    return getNumericId(maybe);
  }

  if (created && typeof created === 'object') {
    const r = created as Record<string, unknown>;
    return getNumericId(r.id ?? r.id_course ?? r.insertId ?? r.insert_id);
  }

  return getNumericId(created);
}

export default resolveInsertId;
