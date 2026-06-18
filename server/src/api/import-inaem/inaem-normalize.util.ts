import { Gender } from "../../types/user/gender.enum";
import { DocumentType } from "../../types/user/document-type.enum";

/**
 * Utilidades de normalización para la importación INAEM.
 * Puras y sin dependencias para poder testearlas de forma aislada.
 */

/** Recorta y colapsa; devuelve undefined si queda vacío (útil para fill-gaps). */
export function cleanText(raw: string | null | undefined): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  return s.length ? s : undefined;
}

/**
 * Sanitiza un DNI/NIE para el matching: mayúsculas y sin espacios, guiones,
 * puntos ni ningún otro carácter no alfanumérico. "Y9002581-G" -> "Y9002581G".
 */
export function sanitizeDni(raw: string | null | undefined): string {
  if (raw == null) return "";
  return String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Infiere el tipo de documento a partir del DNI/NIE sanitizado (NIE empieza por X/Y/Z). */
export function inferDocumentType(sanitized: string): DocumentType {
  return /^[XYZ]/.test(sanitized) ? DocumentType.NIE : DocumentType.DNI;
}

/**
 * Parsea una fecha del INAEM. Acepta dd/mm/yyyy y dd-mm-yyyy (ficheros HTML) e
 * ISO yyyy-mm-dd (celdas de Excel ya convertidas). Devuelve null si no es válida.
 * Se construye a medianoche UTC para evitar desfases por zona horaria.
 */
export function parseInaemDate(raw: string | null | undefined): Date | null {
  const s = cleanText(raw);
  if (!s) return null;
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/); // dd/mm/yyyy
  if (match) {
    d = +match[1]; m = +match[2]; y = +match[3];
  } else {
    match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); // yyyy-mm-dd
    if (!match) return null;
    y = +match[1]; m = +match[2]; d = +match[3];
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  // Rechaza fechas imposibles que JS "corrige" (p.ej. 31/02 -> 03/03)
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
}

/** "Hombre" -> Male, "Mujer" -> Female; cualquier otra cosa -> Other (desconocido). */
export function parseGender(raw: string | null | undefined): Gender {
  const s = cleanText(raw)?.toLowerCase();
  if (s === "hombre" || s === "varón" || s === "varon" || s === "h") return Gender.MALE;
  if (s === "mujer" || s === "m") return Gender.FEMALE;
  return Gender.OTHER;
}

/** "SI"/"SÍ"/"S"/"true"/"1" -> true; el resto -> false. */
export function parseSiNo(raw: string | null | undefined): boolean {
  const s = cleanText(raw)?.toLowerCase();
  if (!s) return false;
  return s === "si" || s === "sí" || s === "s" || s === "true" || s === "1";
}

/** Cabecera del bloque de observaciones de un expediente. */
function observationHeader(fileNumber: string): string {
  return `[INAEM ${fileNumber}]`;
}

/**
 * Construye el bloque de texto a volcar en user.observations para un expediente.
 * Sólo incluye las entradas con valor. Devuelve "" si no hay ninguna (no se añade bloque).
 */
export function buildInaemObservationBlock(
  fileNumber: string,
  entries: { label: string; value: string | null | undefined }[],
): string {
  const lines = entries
    .map((e) => ({ label: e.label, value: cleanText(e.value) }))
    .filter((e) => e.value)
    .map((e) => `${e.label}: ${e.value}`);
  if (!lines.length) return "";
  // Bloque acotado por marca de inicio y cierre, para poder reemplazarlo de forma
  // exacta sin tocar texto manual escrito antes, después o entre bloques.
  return `${observationHeader(fileNumber)}\n${lines.join("\n")}\n[/INAEM ${fileNumber}]`;
}

/**
 * Inserta/reemplaza el bloque de un expediente dentro de un texto de observaciones
 * existente (idempotente: reimportar el mismo expediente reemplaza su bloque, no
 * lo duplica). Preserva cualquier texto previo no relacionado.
 */
export function upsertObservationBlock(
  existing: string | null | undefined,
  fileNumber: string,
  block: string,
): string {
  const current = (existing ?? "").trim();
  const escaped = fileNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Bloque acotado por marca de inicio y cierre (formato actual).
  const closedRe = new RegExp(`\\[INAEM ${escaped}\\][\\s\\S]*?\\[\\/INAEM ${escaped}\\]`);
  // Bloque antiguo SIN marca de cierre (importado antes de este cambio): desde la
  // cabecera hasta el siguiente bloque INAEM o el final.
  const legacyRe = new RegExp(`\\[INAEM ${escaped}\\][\\s\\S]*?(?=\\n\\[INAEM |$)`);

  if (!block) {
    // El nuevo import no trae datos para este expediente: no se toca el contenido.
    // Excepción: si hay un bloque legacy sin cierre, se le añade la marca de cierre
    // (normaliza el formato sin alterar el contenido).
    if (!closedRe.test(current) && legacyRe.test(current)) {
      return current.replace(legacyRe, (m) => `${m.trimEnd()}\n[/INAEM ${fileNumber}]`).trim();
    }
    return current;
  }

  // Hay datos nuevos: reemplazo exacto del bloque (cerrado o legacy) por el nuevo,
  // preservando cualquier texto manual fuera de las marcas.
  if (closedRe.test(current)) {
    return current.replace(closedRe, block).trim();
  }
  if (legacyRe.test(current)) {
    return current.replace(legacyRe, block).trim();
  }
  return current ? `${current}\n\n${block}` : block;
}
