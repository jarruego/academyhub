/**
 * Paleta semántica central de la aplicación.
 *
 * Única fuente de verdad para los colores de tags/estados/flags. Antes estos
 * colores estaban dispersos y copiados (courses.route, baja-tag, etc.); cualquier
 * etiqueta de estado debe leer de aquí en lugar de pasar un `color="..."` suelto.
 *
 * Los valores son nombres de preset de Ant Design (`<Tag color="geekblue">`),
 * de modo que siguen el tema y el modo oscuro automáticamente.
 */

import { CourseOrigin } from "../shared/types/course/course-origin.enum";
import { CourseFunding } from "../shared/types/course/course-funding.enum";
import { CourseModality } from "../shared/types/course/course-modality.enum";

/** Color de tag para el origen del curso (¿quién lo encarga?). */
export const ORIGIN_COLORS: Record<CourseOrigin, string> = {
  [CourseOrigin.INAEM]: "geekblue",
  [CourseOrigin.PRIVADA]: "green",
};

/** Color de tag para la financiación del curso (¿cómo se paga?). */
export const FUNDING_COLORS: Record<CourseFunding, string> = {
  [CourseFunding.FUNDAE]: "gold",
  [CourseFunding.PUBLICA]: "geekblue",
  [CourseFunding.PRIVADA]: "blue",
};

/** Color de tag para la modalidad del curso. */
export const MODALITY_COLORS: Record<CourseModality, string> = {
  [CourseModality.ONLINE]: "cyan",
  [CourseModality.PRESENTIAL]: "purple",
  [CourseModality.MIXED]: "magenta",
};

/**
 * Primitivos de estado. Única fuente de los colores "semáforo" de toda la app
 * (tags de activo/inactivo, finalizado, estados de import/jobs, etc.). Cambiar
 * aquí un primitivo lo propaga a todas las pantallas.
 *
 * Usan nombres de preset de Ant (`green`/`red`/`orange`) para coincidir con los
 * tags user-facing. Si en el futuro se prefieren los alias temáticos de Ant
 * (`success`/`error`/`warning`, ligados a los tokens del tema), basta cambiarlos
 * aquí. `processing` no tiene preset equivalente → se usa el alias de Ant.
 */
export const STATUS_COLORS = {
  active: "green",
  inactive: "red",
  warning: "orange",
  processing: "processing",
  neutral: "default",
} as const;

/** Flags puntuales reutilizables. */
export const FLAG_COLORS = {
  /** Curso provisional (autocreado en importación, pendiente de datos). */
  provisional: "orange",
  /** Usuario dado de baja en su centro/empresa principal. */
  baja: "red",
  /** Estado activo forzado manualmente (override de `active_mode`). */
  manual: "gold",
} as const;

/** Devuelve el color de origen, con fallback neutro para valores nulos/desconocidos. */
export function originColor(origin?: string | null): string {
  if (!origin) return STATUS_COLORS.neutral;
  return ORIGIN_COLORS[origin as CourseOrigin] ?? STATUS_COLORS.neutral;
}

/** Devuelve el color de financiación, con fallback neutro para valores nulos/desconocidos. */
export function fundingColor(funding?: string | null): string {
  if (!funding) return STATUS_COLORS.neutral;
  return FUNDING_COLORS[funding as CourseFunding] ?? STATUS_COLORS.neutral;
}

/**
 * Devuelve el color de modalidad, con fallback neutro. Búsqueda **insensible a
 * mayúsculas** porque algunos orígenes traen la modalidad en mayúsculas
 * (`PRESENCIAL`) y otros con la capitalización del enum (`Presencial`).
 */
export function modalityColor(modality?: string | null): string {
  if (!modality) return STATUS_COLORS.neutral;
  const match = Object.values(CourseModality).find(
    (m) => m.toLowerCase() === String(modality).toLowerCase(),
  );
  return match ? MODALITY_COLORS[match] : STATUS_COLORS.neutral;
}
