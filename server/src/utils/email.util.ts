/**
 * Saneo de correos importados (SAGE u otras fuentes).
 *
 * SAGE entrega correos con ruido (mayusculas, espacios sueltos). Se normaliza a
 * una forma "guardable":
 *   - minusculas (los correos son case-insensitive en la practica),
 *   - sin espacios,
 *   - validacion del set de caracteres (RFC practico) que ADMITE letras
 *     acentuadas (los acentos se conservan tal cual, no se transliteran) pero
 *     rechaza simbolos no autorizados (parentesis, comas, <>, etc.).
 * Si tras limpiar no cumple el formato, devuelve `undefined` (mejor vacio que
 * basura que luego bloquearia notificaciones o el alta en Moodle).
 */

// \p{L} letras (incl. acentuadas), \p{M} marcas combinantes (acentos descompuestos).
const EMAIL_RE = /^[\p{L}\p{M}0-9._%+-]+@[\p{L}\p{M}0-9.-]+\.[a-z]{2,}$/u;

export function sanitizeEmail(email: string | null | undefined): string | undefined {
  if (email === null || email === undefined) return undefined;
  const s = String(email).trim().toLowerCase().replace(/\s+/g, "");
  if (s === "") return undefined;
  return EMAIL_RE.test(s) ? s : undefined;
}
