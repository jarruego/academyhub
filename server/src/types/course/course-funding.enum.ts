/**
 * Financiación de un curso: ¿cómo se paga?
 * - PRIVADA: lo paga íntegramente el cliente/alumno (sin bonificación ni subvención).
 * - FUNDAE: formación bonificada (la empresa bonifica la cuota de la Seguridad Social).
 *   Aplica a cursos de origen PRIVADA; lleva asociado el `fundae_id` (a nivel de
 *   grupo/acción formativa).
 * - PUBLICA: subvención pública (INAEM/SEPE/LANBIDE…). Se asigna automáticamente
 *   a los cursos de cliente INAEM. De este eje se deriva el ámbito público/privado.
 *
 * Eje ortogonal al cliente (ver course-client.enum.ts) y a la modalidad.
 */
export enum CourseFunding {
  PRIVADA = 'PRIVADA',
  FUNDAE = 'FUNDAE',
  PUBLICA = 'PUBLICA',
}
