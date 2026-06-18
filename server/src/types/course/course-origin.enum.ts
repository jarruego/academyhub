/**
 * Origen / financiación de un curso.
 * - CLIENTE: curso contratado por una empresa cliente.
 * - INAEM: acción formativa del INAEM (alumnos libres, sin empresa).
 * - PRIVADO: curso privado.
 * - OTRO: cualquier otro origen.
 *
 * Se etiqueta a nivel de curso (no de alumno): los alumnos INAEM están
 * desempleados y no "pertenecen" al INAEM, pero el expediente sí lo es.
 */
export enum CourseOrigin {
  CLIENTE = 'CLIENTE',
  INAEM = 'INAEM',
  PRIVADO = 'PRIVADO',
  OTRO = 'OTRO',
}
