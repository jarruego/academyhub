import { mapSageEducationLevel, FUNDAE_DEFAULT_EDUCATION_LEVEL } from "../import-sage/education-level.util";

/**
 * Mapeo del campo ESTUDIOS del INAEM a los códigos FUNDAE (1-10) de
 * `users.education_level`. Estrategia:
 *   1. Diccionario explícito de las etiquetas conocidas del INAEM (coincidencia
 *      exacta normalizada). Necesario porque el clasificador por palabras clave
 *      de SAGE se equivoca en algunos casos (p.ej. "FP II/Ciclo Grado medio").
 *   2. Si no está en el diccionario: clasificador por palabras clave de SAGE.
 *   3. Si tampoco clasifica: '10 - Otras titulaciones' (criterio acordado; sólo
 *      rellena, nunca sobreescribe — el fill-gaps lo garantiza aguas arriba).
 * Un ESTUDIOS vacío devuelve undefined (no se inventa nivel).
 */

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Etiquetas exactas del INAEM -> código FUNDAE (claves ya normalizadas).
export const INAEM_EDUCATION_TO_FUNDAE: Record<string, string> = {
  "SIN ESTUDIOS": "1",
  "ESTUDIOS PRIMARIOS": "2",
  "GRADUADO ESCOLAR": "3",
  ESO: "3",
  "FP I": "3", // criterio acordado: 1ª etapa secundaria
  "BUP/COU BACHILLERATO": "4",
  "FP II/CICLO GRADO MEDIO": "4", // criterio acordado: grado medio
  "CICLO GRADO SUPERIOR": "6",
  DIPLOMATURA: "7",
  LICENCIATURA: "8",
};

export function mapInaemEducationLevel(estudios?: string | null): string | undefined {
  const text = (estudios ?? "").trim();
  if (!text) return undefined;
  const key = normalize(text);
  if (INAEM_EDUCATION_TO_FUNDAE[key]) return INAEM_EDUCATION_TO_FUNDAE[key];
  // Fallback: clasificador por palabras clave; si no clasifica, '10'.
  return mapSageEducationLevel(undefined, text) ?? FUNDAE_DEFAULT_EDUCATION_LEVEL;
}
