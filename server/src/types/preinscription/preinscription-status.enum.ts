/**
 * Estado de una preinscripción a un curso/expediente (INAEM).
 * - PREINSCRITO: solicitud registrada (estado inicial al importar).
 * - MATRICULADO: la persona aparece en el listado de alumnos del curso.
 * - DESCARTADO: solicitud descartada (manual).
 * - BAJA: la persona causó baja (manual).
 */
export enum PreinscriptionStatus {
  PREINSCRITO = 'PREINSCRITO',
  MATRICULADO = 'MATRICULADO',
  DESCARTADO = 'DESCARTADO',
  BAJA = 'BAJA',
}
