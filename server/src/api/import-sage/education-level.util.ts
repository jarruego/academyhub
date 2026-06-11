/**
 * Mapeo del nivel de estudios del CSV de SAGE a los códigos FUNDAE (1-10)
 * que usa `users.education_level` (ver EDUCATION_LEVEL_OPTIONS en el cliente).
 *
 * Dos fuentes, por orden de prioridad:
 *  1. 'Código nivel' — tabla estándar de nivel de formación de la Seguridad
 *     Social/SEPE ('0' = no informado).
 *  2. 'Nivel Estudios' — texto libre, se clasifica por palabras clave.
 *
 * Si ninguna fuente clasifica, devuelve undefined; el import aplica entonces
 * FUNDAE_DEFAULT_EDUCATION_LEVEL para rellenar huecos (nunca sobreescribe).
 */

// Nivel FUNDAE asignado por el import cuando el CSV no trae nada clasificable:
// '10 - Otras titulaciones' (criterio de negocio). Solo se usa para rellenar
// huecos (usuarios nuevos o sin nivel en BD), nunca para sobreescribir.
export const FUNDAE_DEFAULT_EDUCATION_LEVEL = '10';

// Códigos SEPE observados en los exports de SAGE -> código FUNDAE.
// Los códigos 21/22 -> 3 y 52 -> 10 son criterio validado de negocio.
export const SAGE_EDUCATION_CODE_TO_FUNDAE: Record<string, string> = {
    '80': '1',  // Sin estudios
    '12': '2',  // Estudios primarios completos
    '21': '3',  // Formación sin titulación 1ª etapa de secundaria
    '22': '3',  // 1ª etapa ESO sin título de graduado
    '23': '3',  // 1ª etapa ESO con título de graduado
    '31': '3',  // Formación con titulación 1ª etapa de secundaria
    '32': '4',  // Enseñanzas de bachillerato
    '33': '4',  // FP grado medio (artes plásticas, diseño, deportivas)
    '34': '4',  // Enseñanzas de grado medio de música y danza
    '41': '4',  // Formación con titulación 2ª etapa de secundaria
    '56': '5',  // Estudios oficiales de especialización profesional
    '51': '6',  // FP superior equivalente (artes plásticas y diseño)
    '53': '6',  // Formación de grado superior
    '54': '7',  // Diplomados o 3 cursos universitarios
    '59': '7',  // Enseñanzas universitarias de grado
    '52': '10', // Títulos universitarios y otros con bachiller
};

// Reglas ordenadas sobre el texto libre normalizado (mayúsculas, sin tildes):
// la primera que casa gana. La regla AUXILIAR va antes que la de universitarios
// para que "AUXILIAR DE ENFERMERIA" / "CUIDADOS AUXILIARES" caigan en 4 y no
// arrastre el término ENFERMERIA hacia 7.
// Nota: SAGE trunca el texto a ~40 caracteres, por eso los patrones de ciclo
// universitario usan "CIC" en vez de "CICLO" ("SEGUNDO CIC", "PRIMER CICL").
const TEXT_RULES: Array<{ fundae: string; pattern: RegExp }> = [
    { fundae: '9', pattern: /DOCTOR/ },
    { fundae: '8', pattern: /LICENCI|MASTER|SEGUNDO CIC|2º CICLO|\b2 CICLO/ },
    { fundae: '4', pattern: /AUXILIAR/ },
    { fundae: '7', pattern: /DIPLOM|PRIMER CIC|1º CICLO|UNIVERSITARI[AO]S? DE GRADO|\bGRADO EN |GRADO UNIVERSITARIO|MAGISTERIO|MAESTR[AO]\b|INGENIER[AO] TECNIC|PERITO|ARQUITECT[AO] TECNIC|3 CURSOS UNIV|ENFERMERIA|FISIOTERAP|PSICOLOG|PODOLOG|TERAPIA OCUPACIONAL|MEDICINA|FARMACIA|UNIVERSITARIO/ },
    { fundae: '6', pattern: /GRADO SUPERIOR|TEC\w*\.?\s?SUPERIOR|ENS\.?\s?SUP|F\.?P\.?\s?(II|2)\b/ },
    { fundae: '5', pattern: /CERT\w*\.?\s?(DE\s)?PROFESIONAL|ESPECIALIZACION PROFESIONAL/ },
    { fundae: '4', pattern: /BACHILLER|\bBUP\b|\bCOU\b|GRADO MEDIO|FORMACION PROFESIONAL|\bFP\b|F\.P\b|SEGUNDA ETAPA|2ª ETAPA|ATENCION SOCIO\s?SANITARIA|INTEGRACION SOCIAL/ },
    { fundae: '3', pattern: /\bESO\b|E\.S\.O|GRADUADO ESCOLAR|GRADUADO EN EDUCACION SECUNDARIA|PRIMERA ETAPA|1ª ETAPA|\bEGB\b|SECUNDARIA/ },
    { fundae: '2', pattern: /PRIMARI|CERTIFICADO ESCOLAR|ESCOLARIDAD/ },
    { fundae: '1', pattern: /SIN ESTUDIOS|ANALFABET|NO SABE/ },
];

function normalizeEducationText(s: string): string {
    return s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
}

export function mapSageEducationLevel(codNivel?: string, nivelEstudios?: string): string | undefined {
    const code = (codNivel || '').trim();
    if (code && code !== '0') {
        const mapped = SAGE_EDUCATION_CODE_TO_FUNDAE[code];
        if (mapped) return mapped;
    }

    const text = normalizeEducationText(nivelEstudios || '');
    if (!text) return undefined;

    for (const { fundae, pattern } of TEXT_RULES) {
        if (pattern.test(text)) return fundae;
    }
    return undefined;
}
