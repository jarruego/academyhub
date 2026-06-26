import { Gender } from "../../types/user/gender.enum";
import { DocumentType } from "../../types/user/document-type.enum";
import {
  cleanText,
  sanitizeDni,
  inferDocumentType,
  parseInaemDate,
  parseGender,
  parseSiNo,
  buildInaemObservationBlock,
} from "./inaem-normalize.util";
import { mapInaemEducationLevel } from "./inaem-education-level.util";
import { COMMON, OBSERVATION_FIELD_HEADERS } from "./inaem-column-map";
import { sanitizeEmail } from "../../utils/email.util";
import { sanitizePhone } from "../../utils/phone.util";

type Row = Record<string, string>;

/** Campos de usuario derivados de una fila del INAEM (Alumnos o Preinscripciones). */
export interface IncomingUserFields {
  dni: string; // sanitizado (clave de matching)
  document_type: DocumentType;
  name?: string;
  first_surname?: string;
  second_surname?: string;
  email?: string;
  phone?: string;
  birth_date?: Date | null;
  gender: Gender;
  disability: boolean;
  education_level?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  province?: string;
}

/** Extrae los campos de usuario de una fila (sin tocar observations). */
export function mapRowToUserFields(row: Row): IncomingUserFields {
  const dni = sanitizeDni(row[COMMON.DNI]);
  return {
    dni,
    document_type: inferDocumentType(dni),
    name: cleanText(row[COMMON.NAME]),
    first_surname: cleanText(row[COMMON.SURNAME1]),
    second_surname: cleanText(row[COMMON.SURNAME2]),
    email: sanitizeEmail(row[COMMON.EMAIL]),
    phone: sanitizePhone(row[COMMON.PHONE_MOBILE]) ?? sanitizePhone(row[COMMON.PHONE_LANDLINE]),
    birth_date: parseInaemDate(row[COMMON.BIRTH_DATE]),
    gender: parseGender(row[COMMON.GENDER]),
    disability: parseSiNo(row[COMMON.DISABILITY]),
    education_level: mapInaemEducationLevel(cleanText(row[COMMON.STUDIES])),
    address: cleanText(row[COMMON.ADDRESS]),
    postal_code: cleanText(row[COMMON.POSTAL_CODE]),
    city: cleanText(row[COMMON.CITY]),
    province: cleanText(row[COMMON.PROVINCE]),
  };
}

/** Construye el bloque de observaciones (texto) para esta fila/expediente. */
export function buildObservationsForRow(fileNumber: string, row: Row): string {
  return buildInaemObservationBlock(
    fileNumber,
    OBSERVATION_FIELD_HEADERS.map((label) => ({ label, value: row[label] })),
  );
}

export interface FieldConflict {
  field: string;
  dbValue: string;
  incomingValue: string;
}

/** Tipo mínimo de usuario existente que necesita el merge (subconjunto de la fila de BD). */
type ExistingUser = {
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  province?: string | null;
  education_level?: string | null;
  birth_date?: Date | string | null;
  gender?: string | null;
  disability?: boolean | null;
};

const TEXT_FIELDS = ["email", "phone", "address", "postal_code", "city", "province", "education_level"] as const;

function norm(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

/**
 * Calcula el update fill-gaps (sólo rellena lo que está vacío en BD) y la lista
 * de conflictos (BD tiene un valor distinto al entrante; NO se sobrescribe, se
 * registra para decisión manual). Nunca toca nombre/apellidos/dni.
 */
export function computeUserMerge(
  existing: ExistingUser,
  incoming: IncomingUserFields,
): { update: Record<string, unknown>; conflicts: FieldConflict[] } {
  const update: Record<string, unknown> = {};
  const conflicts: FieldConflict[] = [];

  for (const field of TEXT_FIELDS) {
    const inVal = (incoming as any)[field] as string | undefined;
    if (!inVal) continue;
    const dbVal = (existing as any)[field] as string | null | undefined;
    if (!cleanText(dbVal ?? undefined)) {
      update[field] = inVal;
    } else if (norm(dbVal) !== norm(inVal)) {
      conflicts.push({ field, dbValue: String(dbVal), incomingValue: inVal });
    }
  }

  // gender: 'Other'/null se considera desconocido (rellenable); un valor entrante Other no aporta.
  if (incoming.gender !== Gender.OTHER) {
    const dbGender = existing.gender;
    if (!dbGender || dbGender === Gender.OTHER) {
      update.gender = incoming.gender;
    } else if (dbGender !== incoming.gender) {
      conflicts.push({ field: "gender", dbValue: dbGender, incomingValue: incoming.gender });
    }
  }

  // birth_date
  if (incoming.birth_date) {
    if (!existing.birth_date) {
      update.birth_date = incoming.birth_date;
    } else {
      const dbTime = new Date(existing.birth_date).getTime();
      if (dbTime !== incoming.birth_date.getTime()) {
        conflicts.push({
          field: "birth_date",
          dbValue: new Date(existing.birth_date).toISOString().slice(0, 10),
          incomingValue: incoming.birth_date.toISOString().slice(0, 10),
        });
      }
    }
  }

  // disability: sólo rellena si en BD es null (no se considera conflicto false<->true por defecto)
  if (existing.disability === null || existing.disability === undefined) {
    update.disability = incoming.disability;
  }

  return { update, conflicts };
}
