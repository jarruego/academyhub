import { sanitizeEmail } from "src/utils/email.util";
import { sanitizePhone } from "src/utils/phone.util";
import { canonicalNss, isValidNss } from "src/utils/nss.util";
import { isValidDocument } from "src/utils/dni.util";

/** Campos de usuario que esta herramienta sabe validar. */
export type SanitizableField = "phone" | "email" | "dni" | "nss";

/** Campos cuyo error puede corregirse automáticamente desde el servidor. */
export const AUTO_FIXABLE_FIELDS = ["phone", "email", "nss"] as const;
export type AutoFixableField = (typeof AUTO_FIXABLE_FIELDS)[number];

export interface UserIssue {
  field: SanitizableField;
  /** Valor actual (tal cual está en BD, ya recortado de espacios extremos). */
  value: string;
  /** true si el servidor puede proponer y aplicar una corrección automática. */
  fixable: boolean;
  /** Valor saneado propuesto (solo si `fixable`); null en caso contrario. */
  suggestion: string | null;
}

/** Subconjunto de campos del usuario que necesita la detección. */
export interface SanitizableUser {
  email?: string | null;
  phone?: string | null;
  dni?: string | null;
  nss?: string | null;
}

/**
 * Calcula el valor saneado propuesto para un campo concreto (o null si no es
 * auto-corregible). Es la fuente de verdad usada tanto por la detección como
 * por el endpoint de corrección, para que ambos coincidan exactamente.
 */
export function suggestFix(field: AutoFixableField, rawValue: string): string | null {
  const value = rawValue.trim();
  if (value === "") return null;
  switch (field) {
    case "phone": {
      const sane = sanitizePhone(value);
      return sane && sane !== value ? sane : null;
    }
    case "email": {
      const sane = sanitizeEmail(value);
      return sane && sane !== value ? sane : null;
    }
    case "nss": {
      const canonical = canonicalNss(value);
      return canonical && isValidNss(canonical) && canonical !== value ? canonical : null;
    }
  }
}

/**
 * Valida y normaliza un valor introducido a mano para un campo. Devuelve la
 * forma a guardar si es válido, o null si no supera la validación del campo.
 * Es la puerta de entrada de la corrección manual: no se guarda nada inválido
 * (si no, el error reaparecería).
 */
export function normalizeValidValue(field: SanitizableField, rawValue: string): string | null {
  const value = rawValue.trim();
  if (value === "") return null;
  switch (field) {
    case "phone":
      return sanitizePhone(value) ?? null;
    case "email":
      return sanitizeEmail(value) ?? null;
    case "dni":
      return isValidDocument(value) ? value.toUpperCase() : null;
    case "nss": {
      const canonical = canonicalNss(value);
      return canonical && isValidNss(canonical) ? canonical : null;
    }
  }
}

/**
 * Detecta los campos "presentes pero inválidos" de un usuario. Los campos vacíos
 * NO se consideran error. Reutiliza los validadores existentes
 * (email/phone/nss/dni .util).
 */
export function detectUserIssues(user: SanitizableUser): UserIssue[] {
  const issues: UserIssue[] = [];

  const phone = user.phone?.trim();
  if (phone) {
    if (sanitizePhone(phone) === undefined) {
      issues.push({ field: "phone", value: phone, fixable: false, suggestion: null });
    } else {
      const suggestion = suggestFix("phone", phone);
      if (suggestion) issues.push({ field: "phone", value: phone, fixable: true, suggestion });
    }
  }

  const email = user.email?.trim();
  if (email) {
    if (sanitizeEmail(email) === undefined) {
      issues.push({ field: "email", value: email, fixable: false, suggestion: null });
    } else {
      const suggestion = suggestFix("email", email);
      if (suggestion) issues.push({ field: "email", value: email, fixable: true, suggestion });
    }
  }

  const dni = user.dni?.trim();
  if (dni && !isValidDocument(dni)) {
    issues.push({ field: "dni", value: dni, fixable: false, suggestion: null });
  }

  const nss = user.nss?.trim();
  if (nss && !isValidNss(nss)) {
    const suggestion = suggestFix("nss", nss);
    issues.push({ field: "nss", value: nss, fixable: suggestion !== null, suggestion });
  }

  return issues;
}
