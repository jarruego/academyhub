import { CourseModality } from "../shared/types/course/course-modality.enum";
import { CourseOrigin } from "../shared/types/course/course-origin.enum";
import { CourseFunding } from "../shared/types/course/course-funding.enum";

/**
 * Fuente única de verdad para decidir qué muestra la UI según la tipología del
 * curso. Combina los tres ejes ortogonales (modalidad / origen / financiación)
 * y expone capacidades declarativas, en vez de repartir `modality === 'presencial'`
 * por los componentes.
 *
 * Acepta strings sueltos (las props llegan a veces como `string | null`) y
 * compara sin distinguir mayúsculas/minúsculas. Los valores de los enums no
 * llevan acentos, así que basta con `toLowerCase`.
 */
export interface CourseProfileInput {
  modality?: CourseModality | string | null;
  origin?: CourseOrigin | string | null;
  funding?: CourseFunding | string | null;
}

export interface CourseProfile {
  // Ejes normalizados
  isPresential: boolean;
  isOnline: boolean;
  isMixed: boolean;
  isInaem: boolean;
  isFundae: boolean;
  // Capacidades de UI
  /** Sincronización con Moodle (online/mixta; un presencial no se sube a Moodle). */
  showMoodleSync: boolean;
  /** Columna de porcentaje de progreso (+ tiempo usado). */
  showProgressColumn: boolean;
  /** Columna de finalización (presencial: el porcentaje no aplica). */
  showFinalizedColumn: boolean;
  /** Botón de bonificación FUNDAE. */
  showBonificationButton: boolean;
  /** Nº de expediente INAEM. */
  showExpediente: boolean;
  /** Pestaña de preinscripciones (INAEM). */
  showPreinscripciones: boolean;
}

const norm = (v: string | null | undefined): string => String(v ?? "").toLowerCase().trim();

export function getCourseProfile(input: CourseProfileInput): CourseProfile {
  const modality = norm(input.modality);
  const origin = norm(input.origin);
  const funding = norm(input.funding);

  const isPresential = modality === norm(CourseModality.PRESENTIAL);
  const isOnline = modality === norm(CourseModality.ONLINE);
  const isMixed = modality === norm(CourseModality.MIXED);
  const isInaem = origin === norm(CourseOrigin.INAEM);
  const isFundae = funding === norm(CourseFunding.FUNDAE);

  return {
    isPresential,
    isOnline,
    isMixed,
    isInaem,
    isFundae,
    // Un presencial no se sincroniza con Moodle ni tiene progreso; el resto sí.
    showMoodleSync: !isPresential,
    showProgressColumn: !isPresential,
    showFinalizedColumn: isPresential,
    showBonificationButton: isFundae,
    showExpediente: isInaem,
    showPreinscripciones: isInaem,
  };
}
