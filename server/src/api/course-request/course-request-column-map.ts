/**
 * Alias de cabecera admitidos por campo para el Excel de alta de alumnos de una
 * petición. Los centros no siempre respetan el orden ni el nombre exacto de las
 * columnas, así que el matching es por nombre de cabecera (normalizado), no por
 * posición. Columnas no reconocidas (p.ej. CENTRO, MAIL suelto en plantillas
 * antiguas) se ignoran sin error.
 */
export type CourseRequestStudentField =
  | "name"
  | "first_surname"
  | "second_surname"
  | "dni"
  | "email"
  | "phone_mobile";

export const COURSE_REQUEST_STUDENT_COLUMN_ALIASES: Record<CourseRequestStudentField, string[]> = {
  name: ["NOMBRE"],
  first_surname: ["APELLIDO 1", "APELLIDO1", "AP1", "AP.1", "PRIMER APELLIDO", "1ER APELLIDO"],
  second_surname: ["APELLIDO 2", "APELLIDO2", "AP2", "AP.2", "SEGUNDO APELLIDO", "2O APELLIDO", "2DO APELLIDO"],
  dni: ["DNI", "NIF", "NIF/NIE", "NIE"],
  email: ["CORREO ELECTRONICO", "CORREO ELECTRÓNICO", "EMAIL", "CORREO", "E-MAIL"],
  phone_mobile: ["TELEFONO MOVIL", "TELÉFONO MÓVIL", "MOVIL", "MÓVIL", "TELEFONO", "TELÉFONO"],
};

// Columnas que puede traer la plantilla pero que se ignoran a propósito: CENTRO
// (el centro se elige a mano al crear la petición, no se lee del Excel) y una
// segunda columna EMAIL/CORREO duplicada (p. ej. el contacto del centro). Como
// el matching toma la PRIMERA columna que encaja con cada alias, un segundo
// "email" tras "centro" queda sin usar automáticamente.

/** Campos obligatorios para poder guardar la fila (alineado con CourseRequestStudentDto). */
export const REQUIRED_COURSE_REQUEST_STUDENT_FIELDS: CourseRequestStudentField[] = [
  "name",
  "first_surname",
  "dni",
  "email",
];

/** Mayúsculas, sin acentos, espacios colapsados. Para comparar cabeceras de forma tolerante. */
const DIACRITICS_REGEX = new RegExp("[\\u0300-\\u036f]", "g");

export function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}
