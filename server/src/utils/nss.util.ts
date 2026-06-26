/**
 * Utilidades del Número de Seguridad Social (NSS / NAF) español.
 *
 * Formato válido: 12 dígitos = PP (provincia, 2) + NNNNNNNN (nº afiliación, 8) +
 * CC (control, 2). El dígito de control es el resto de dividir la "base" entre 97,
 * según el algoritmo OFICIAL de la Seguridad Social:
 *   - si el nº de afiliación (numérico) es < 10.000.000 (lleva ceros a la
 *     izquierda): base = afiliación + provincia · 10.000.000;
 *   - en caso contrario: base = provincia concatenada con afiliación (provincia · 10^8 + afiliación).
 * (Antes se usaba siempre la concatenación de los 10 primeros dígitos, lo que
 * marcaba como inválidos los NSS con afiliación de cero a la izquierda, p. ej.
 * 410095952008 → provincia 41, afiliación 00959520, control 08, que SÍ es válido.)
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

/** true si es un NSS de 12 dígitos con dígito de control correcto (algoritmo oficial). */
export function isValidNss(nss: string | null | undefined): boolean {
  const d = nssDigits(nss);
  if (d.length !== 12) return false;
  const provincia = Number(d.slice(0, 2));
  const afiliacion = Number(d.slice(2, 10));
  const control = Number(d.slice(10, 12));
  const base = afiliacion < 10_000_000 ? afiliacion + provincia * 10_000_000 : provincia * 100_000_000 + afiliacion;
  return base % 97 === control;
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
