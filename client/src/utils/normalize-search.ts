export function normalizeSearch(input?: string): string {
  if (!input) return '';
  return input
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/_/g, ' ') // treat underscores as spaces
    .replace(/[^\w\s@.-]/g, '') // remove special characters but preserve @ . - for email
    .toLowerCase();
}

/**
 * Normalización ligera para el filtrado en cliente: solo quita diacríticos y
 * pasa a minúsculas, conservando el resto de caracteres (p. ej. `/` en nº de
 * expediente). Centraliza el `normalize` inline que estaba copiado en cursos,
 * grupos, empresas y centros.
 */
export function normalizeLoose(input?: string | null): string {
  if (!input) return '';
  return String(input).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Devuelve `true` si alguno de los campos contiene el término de búsqueda
 * (ambos normalizados con `normalizeLoose`). `query` debe venir ya normalizado.
 */
export function matchesLoose(query: string, fields: Array<string | number | null | undefined>): boolean {
  if (!query) return true;
  return fields.some((f) => normalizeLoose(f == null ? '' : String(f)).includes(query));
}
