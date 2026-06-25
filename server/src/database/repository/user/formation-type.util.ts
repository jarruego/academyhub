/**
 * Tipo de formación de un alumno, derivado de los cursos en los que está
 * matriculado. Casa con las pestañas/filtros de la UI. Combina los dos ejes de
 * tipología del curso: `funding` (financiación) y `client` (cliente/comitente).
 *
 *  - `fundae`   → financiación FUNDAE (bonificada).
 *  - `publica`  → financiación pública (INAEM, SEPE, LANBIDE…).
 *  - `inaem`    → cliente INAEM en concreto (subconjunto de pública).
 *  - `privada`  → financiación privada no bonificada.
 */
export type FormationType = 'fundae' | 'publica' | 'inaem' | 'privada';

export interface FormationTypePredicate {
  /** Columna de `courses` sobre la que se filtra. */
  column: 'funding' | 'client';
  /** Valor exacto que debe tener esa columna. */
  value: string;
}

/**
 * Traduce un `FormationType` a la columna + valor de `courses` que lo define.
 * Lógica pura (sin SQL ni dependencias) para poder testearla; el repositorio
 * construye la condición SQL a partir del resultado.
 */
export function formationTypePredicate(type: FormationType): FormationTypePredicate {
  switch (type) {
    case 'fundae':
      return { column: 'funding', value: 'FUNDAE' };
    case 'publica':
      return { column: 'funding', value: 'PUBLICA' };
    case 'inaem':
      return { column: 'client', value: 'INAEM' };
    case 'privada':
      return { column: 'funding', value: 'PRIVADA' };
  }
}
