/**
 * Estado de una petición de curso de un centro.
 * - ABIERTA: en edición, aún no usada para matricular.
 * - CERRADA: cierre manual o (en el futuro) al usarse para matricular en un grupo.
 */
export enum CourseRequestStatus {
  ABIERTA = 'ABIERTA',
  CERRADA = 'CERRADA',
}
