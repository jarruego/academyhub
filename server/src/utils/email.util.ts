/**
 * Saneo de correos importados (SAGE u otras fuentes).
 *
 * SAGE entrega correos con ruido (mayusculas, espacios sueltos, tildes por mala
 * codificacion o tecleo). Se normaliza a una forma "guardable":
 *   - minusculas (los correos son case-insensitive en la practica),
 *   - sin espacios,
 *   - sin diacriticos (a-acento -> a, enie -> n, u-dieresis -> u): un buzon real
 *     casi nunca lleva tilde, asi que se trata como error de entrada y se corrige
 *     en vez de perder el dato,
 *   - validacion estricta del set de caracteres (RFC practico).
 * Si tras limpiar no cumple el formato, devuelve `undefined` (mejor vacio que
 * basura que luego bloquearia notificaciones o el alta en Moodle).
 */

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

/** Quita diacriticos preservando la letra base (combining marks U+0300-U+036F). */
function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function sanitizeEmail(email: string | null | undefined): string | undefined {
  if (email === null || email === undefined) return undefined;
  let s = String(email).trim().toLowerCase();
  if (s === "") return undefined;
  s = stripDiacritics(s).replace(/\s+/g, "");
  return EMAIL_RE.test(s) ? s : undefined;
}
