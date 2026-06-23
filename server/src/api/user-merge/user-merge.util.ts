import { PreinscriptionStatus } from "src/types/preinscription/preinscription-status.enum";

/**
 * Normaliza un NSS para comparar duplicados: elimina todo lo que no sea dígito
 * y quita los ceros a la izquierda. Devuelve '' si no queda nada.
 * Ej.: '081358086457' y '81358086457' → '81358086457'.
 */
export function normalizeNss(nss: string | null | undefined): string {
  if (!nss) return "";
  const digits = String(nss).replace(/\D/g, "");
  return digits.replace(/^0+/, "");
}

/**
 * Normaliza un nombre completo para comparar (minúsculas, sin acentos, espacios
 * colapsados). Usado solo para señalar posibles falsos positivos en la UI.
 */
export function normalizeName(...parts: Array<string | null | undefined>): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Campos escalares de `users` que el admin puede traer desde la ficha perdedora
 * al fusionar. Es la whitelist que valida el servicio (evita escribir columnas
 * arbitrarias). Excluye id_user y los timestamps de auditoría.
 */
export const MERGEABLE_FIELDS = [
  "name",
  "first_surname",
  "second_surname",
  "email",
  "registration_date",
  "birth_date",
  "dni",
  "phone",
  "nss",
  "document_type",
  "gender",
  "job_position",
  "contribution_group_code",
  "professional_category",
  "salary_group",
  "disability",
  "terrorism_victim",
  "gender_violence_victim",
  "education_level",
  "address",
  "postal_code",
  "city",
  "province",
  "country",
  "observations",
  "seasonalWorker",
  "erteLaw",
  "accreditationDiploma",
] as const;

export type MergeableField = (typeof MERGEABLE_FIELDS)[number];

// ---------- comparadores de valores ----------

function toTime(d: Date | string | null | undefined): number | null {
  if (d == null) return null;
  const t = new Date(d).getTime();
  return isNaN(t) ? null : t;
}

/** Devuelve la fecha más antigua (no nula) entre dos. */
export function earliestDate<T extends Date | string | null | undefined>(a: T, b: T): T {
  const ta = toTime(a), tb = toTime(b);
  if (ta == null) return b;
  if (tb == null) return a;
  return ta <= tb ? a : b;
}

/** Devuelve la fecha más reciente (no nula) entre dos. */
export function latestDate<T extends Date | string | null | undefined>(a: T, b: T): T {
  const ta = toTime(a), tb = toTime(b);
  if (ta == null) return b;
  if (tb == null) return a;
  return ta >= tb ? a : b;
}

/** Mayor entero (no nulo) entre dos. */
export function maxNum(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null) return b ?? null;
  if (b == null) return a;
  return Math.max(a, b);
}

/** Mayor decimal (columnas `decimal` de Drizzle llegan como string|null). */
export function maxDecimal(a: string | null | undefined, b: string | null | undefined): string | null {
  if (a == null) return b ?? null;
  if (b == null) return a;
  return parseFloat(a) >= parseFloat(b) ? a : b;
}

// Estado de preinscripción más "fuerte": MATRICULADO > PREINSCRITO > BAJA > DESCARTADO.
const PREINSCRIPTION_RANK: Record<string, number> = {
  [PreinscriptionStatus.MATRICULADO]: 3,
  [PreinscriptionStatus.PREINSCRITO]: 2,
  [PreinscriptionStatus.BAJA]: 1,
  [PreinscriptionStatus.DESCARTADO]: 0,
};

export function strongerPreinscriptionStatus(a: string, b: string): string {
  return (PREINSCRIPTION_RANK[a] ?? -1) >= (PREINSCRIPTION_RANK[b] ?? -1) ? a : b;
}

// ---------- fusión de filas hijas compartidas (winner ⊕ loser) ----------

export function mergeUserCourseRow(w: any, l: any) {
  return {
    completion_percentage: maxDecimal(w.completion_percentage, l.completion_percentage),
    time_spent: maxNum(w.time_spent, l.time_spent),
    enrollment_date: earliestDate(w.enrollment_date, l.enrollment_date),
    id_moodle_user: w.id_moodle_user ?? l.id_moodle_user ?? null,
  };
}

export function mergeUserGroupRow(w: any, l: any) {
  return {
    finalized: !!w.finalized || !!l.finalized,
    is_tutor: !!w.is_tutor || !!l.is_tutor,
    id_role: w.id_role ?? l.id_role ?? null,
    id_center: w.id_center ?? l.id_center ?? null,
    completion_percentage: maxDecimal(w.completion_percentage, l.completion_percentage),
    time_spent: maxNum(w.time_spent, l.time_spent),
    last_access: latestDate(w.last_access, l.last_access),
    join_date: earliestDate(w.join_date, l.join_date),
    moodle_synced_at: latestDate(w.moodle_synced_at, l.moodle_synced_at),
  };
}

export function mergePreinscriptionRow(w: any, l: any) {
  return {
    status: strongerPreinscriptionStatus(w.status, l.status),
    prioritaria: !!w.prioritaria || !!l.prioritaria,
    preinscription_date: earliestDate(w.preinscription_date, l.preinscription_date),
  };
}
