/**
 * Saneo de teléfonos importados (SAGE u otras fuentes).
 *
 * SAGE entrega teléfonos con separadores heterogéneos (espacios, puntos,
 * guiones, paréntesis). Se normaliza a solo dígitos —conservando un prefijo
 * internacional `+` si viene— y se exige un mínimo de 9 dígitos (longitud de un
 * teléfono español); por debajo de eso se considera basura/dato parcial y se
 * descarta (mejor vacío que un teléfono inutilizable).
 */

/** Solo los dígitos de un teléfono (sin espacios, puntos, guiones, etc.). */
export function phoneDigits(phone: string | null | undefined): string {
  return phone ? String(phone).replace(/\D/g, "") : "";
}

/**
 * Forma saneada para GUARDAR: quita espacios/puntos/guiones/paréntesis y deja
 * solo dígitos (preservando un `+` inicial si lo había). Devuelve `undefined`
 * si tras limpiar quedan menos de 9 dígitos (no importable). No inventa datos:
 * null/''/basura → undefined.
 */
export function sanitizePhone(phone: string | null | undefined): string | undefined {
  if (phone === null || phone === undefined) return undefined;
  const raw = String(phone).trim();
  if (raw === "") return undefined;
  const hasPlus = raw.startsWith("+");
  const digits = phoneDigits(raw);
  if (digits.length < 9) return undefined;
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Forma E.164 para enviar SMS (Mailrelay exige "+<código país><número>").
 * `users.phone` se guarda saneado pero sin prefijo internacional en la
 * mayoría de los casos (base de usuarios española) — si no viene con `+`,
 * se antepone el código de país por defecto. Devuelve `undefined` si el
 * teléfono no es válido tras el saneo (ver `sanitizePhone`).
 */
export function toE164Phone(phone: string | null | undefined, defaultCountryCode = "+34"): string | undefined {
  const sanitized = sanitizePhone(phone);
  if (!sanitized) return undefined;
  return sanitized.startsWith("+") ? sanitized : `${defaultCountryCode}${sanitized}`;
}
