/**
 * Utilidades del Número de Seguridad Social (NSS / NAF) español.
 *
 * Formato válido: 12 dígitos = PP (provincia, 2) + NNNNNNNN (nº afiliación, 8) +
 * CC (control, 2). El dígito de control es el resto de dividir los 10 primeros
 * dígitos entre 97. Verificado empíricamente contra los datos reales (el ~86% de
 * los NSS de 12 dígitos en BD lo cumplen; el resto son tecleos erróneos legacy).
 *
 * Problema frecuente: muchos NSS se guardaron SIN el cero a la izquierda (11
 * dígitos), por conversión numérica en Excel/SAGE. La forma canónica rellena con
 * ceros a 12 dígitos; entre dos variantes equivalentes, la válida (con checksum
 * correcto) es la que debe conservarse.
 */

/** Solo los dígitos de un NSS (sin espacios, guiones, etc.). */
export function nssDigits(nss: string | null | undefined): string {
  return nss ? String(nss).replace(/\D/g, "") : "";
}

/** true si es un NSS de 12 dígitos con dígito de control correcto. */
export function isValidNss(nss: string | null | undefined): boolean {
  const d = nssDigits(nss);
  if (d.length !== 12) return false;
  return Number(d.slice(0, 10)) % 97 === Number(d.slice(10, 12));
}

/**
 * Forma canónica para GUARDAR: rellena con ceros a la izquierda hasta 12 dígitos.
 * Preserva null/'' (no inventa un NSS). No rechaza: si el checksum no cuadra,
 * devuelve igualmente la forma de 12 dígitos (mejor esfuerzo, sin perder dato).
 */
export function canonicalNss<T extends string | null | undefined>(nss: T): T | string {
  if (nss === null || nss === undefined) return nss;
  const d = nssDigits(nss);
  if (d === "") return nss; // nada utilizable: se deja tal cual
  return d.length < 12 ? d.padStart(12, "0") : d;
}

/**
 * Elige el NSS que debe conservarse entre dos variantes (p.ej. al fusionar
 * usuarios): prioriza el que pasa el dígito de control, INDEPENDIENTEMENTE de
 * cuál sea el ganador. Si ninguno valida, prefiere el primero no vacío. Devuelve
 * siempre la forma canónica (12 dígitos) o null/'' si ambos están vacíos.
 */
export function pickValidNss(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  const ca = canonicalNss(a) ?? null;
  const cb = canonicalNss(b) ?? null;
  const va = isValidNss(ca);
  const vb = isValidNss(cb);
  if (va && !vb) return ca as string;
  if (vb && !va) return cb as string;
  // ambos válidos (misma persona) o ninguno válido: preferir el primero no vacío
  if (nssDigits(ca) !== "") return ca as string;
  if (nssDigits(cb) !== "") return cb as string;
  return null;
}
