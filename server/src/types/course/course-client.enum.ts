/**
 * Cliente/comitente de un curso: ¿para quién es / quién lo encarga?
 * - INAEM: acción formativa de la administración (subvención pública para
 *   desempleados; gestión por expediente, preinscripciones y finalización).
 *   Activa las funciones específicas INAEM.
 * - VITALIA: cliente privado principal (formación mayoritariamente bonificada FUNDAE).
 * - OTRO: cualquier otro cliente — empresas privadas, particulares u otras
 *   administraciones públicas (LANBIDE, SEPE, Servicio Riojano de Empleo…).
 *
 * El ámbito público/privado NO se almacena aquí: se DERIVA de la financiación
 * (course-funding.enum.ts: PUBLICA ⇒ público; FUNDAE/PRIVADA ⇒ privado).
 * Eje ortogonal a la modalidad. Se etiqueta a nivel de curso, no de alumno.
 * Ampliable: un cliente nuevo (p.ej. LANBIDE) es un valor más, sin tocar la
 * lógica de ámbito.
 */
export enum CourseClient {
  INAEM = 'INAEM',
  VITALIA = 'VITALIA',
  OTRO = 'OTRO',
}
