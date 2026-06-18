/**
 * Origen de un curso: ¿quién lo encarga / para quién es?
 * - PRIVADA: formación de mercado (empresas cliente y, ocasionalmente, particulares).
 *   La empresa/cliente concreto se deriva de la `company` del alumno; el que sea
 *   particular se deriva de que el alumno no tenga empresa asociada.
 * - INAEM: acción formativa de la administración (subvención pública para
 *   desempleados; gestión por expediente, preinscripciones y finalización).
 *
 * Eje ortogonal a la financiación (ver course-funding.enum.ts) y a la modalidad.
 * Se etiqueta a nivel de curso, no de alumno.
 */
export enum CourseOrigin {
  PRIVADA = 'PRIVADA',
  INAEM = 'INAEM',
}
