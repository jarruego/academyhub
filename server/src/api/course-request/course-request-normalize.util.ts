import { sanitizeEmail } from "src/utils/email.util";

/**
 * Saneo de los campos de alumno de una petición (Excel, pegado manual o
 * guardado desde la grid). No descarta datos inválidos (a diferencia de SAGE/
 * INAEM): esto es contenido editable por el usuario, así que se normaliza la
 * forma (espacios, mayúsculas/minúsculas) pero se conserva el valor aunque no
 * sea válido, para que se pueda ver (en rojo, en el cliente) y corregir.
 */

/** Recorta y colapsa espacios internos. */
export function normalizeText(raw: string | null | undefined): string {
  if (raw == null) return "";
  return String(raw).trim().replace(/\s+/g, " ");
}

/** Mayúsculas y sin espacios/guiones/puntos (p. ej. "12345678-A" -> "12345678A"). */
export function normalizeDni(raw: string | null | undefined): string {
  if (raw == null) return "";
  return String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Trim + minúsculas + sin espacios internos. Reutiliza `sanitizeEmail`
 * (src/utils/email.util.ts) cuando el resultado es válido; si no lo es, aplica
 * el mismo aseo superficial sin descartar el valor (para poder mostrarlo y
 * corregirlo, a diferencia de las importaciones SAGE/INAEM).
 */
export function normalizeEmail(raw: string | null | undefined): string {
  if (raw == null) return "";
  const sanitized = sanitizeEmail(raw);
  if (sanitized) return sanitized;
  return String(raw).trim().toLowerCase().replace(/\s+/g, "");
}

/** Quita espacios/puntos/guiones/paréntesis, conservando un "+" inicial si lo había. */
export function normalizePhone(raw: string | null | undefined): string {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  const hasPlus = s.startsWith("+");
  const digits = s.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}
