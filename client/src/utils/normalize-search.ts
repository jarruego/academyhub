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
