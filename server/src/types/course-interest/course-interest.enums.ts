export enum InterestStatus {
  INTERESTED = "INTERESADO",
  CONTACTED = "CONTACTADO",
  // CALLED y ENROLLED son estados derivados: solo los asigna el sistema
  // (CourseInterestService.incorporate / CourseCandidateService al
  // sincronizar la candidatura vinculada). Nunca deben ser seleccionables a
  // mano — implican que existe una `course_candidates` real detrás.
  CALLED = "CONVOCADO",
  ENROLLED = "MATRICULADO",
  DISCARDED = "DESCARTADO",
}

// Estados que solo puede asignar el sistema (ver comentario arriba). Usado
// para rechazar transiciones manuales hacia ellos en `updateMany`.
export const SYSTEM_ONLY_INTEREST_STATUSES = [InterestStatus.CALLED, InterestStatus.ENROLLED];

export enum InterestSource {
  PHONE = "TELEFONO",
  WEB = "WEB",
  IN_PERSON = "PRESENCIAL",
  CENTER = "CENTRO",
  IMPORT = "IMPORTACION",
  OTHER = "OTRO",
}

// Estados en los que un interés se considera "disponible" para incorporar a
// una edición (aún no está gestionándose en ninguna convocatoria concreta).
export const OPEN_INTEREST_STATUSES = [InterestStatus.INTERESTED, InterestStatus.CONTACTED];
