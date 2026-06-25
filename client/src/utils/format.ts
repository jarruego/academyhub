/**
 * Helpers de formato centralizados (fechas y números) en locale es-ES.
 *
 * Antes cada tabla llamaba a `new Date(x).toLocaleDateString('es-ES')` inline,
 * con variaciones (algunas sin locale, otras sobre timestamps). Esto unifica el
 * criterio y el manejo de valores nulos/ inválidos.
 */

const LOCALE = "es-ES";

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fecha corta (dd/mm/aaaa). Devuelve `fallback` si el valor es nulo/ inválido. */
export function formatDate(value: DateInput, fallback = ""): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString(LOCALE) : fallback;
}

/** Fecha y hora (dd/mm/aaaa hh:mm). Devuelve `fallback` si el valor es nulo/ inválido. */
export function formatDateTime(value: DateInput, fallback = ""): string {
  const d = toDate(value);
  return d
    ? d.toLocaleString(LOCALE, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : fallback;
}

/** Número con separadores de miles es-ES. Devuelve `fallback` si no es finito. */
export function formatNumber(value: number | null | undefined, fallback = ""): string {
  if (value == null || !Number.isFinite(value)) return fallback;
  return value.toLocaleString(LOCALE);
}
