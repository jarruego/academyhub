/**
 * Nombres exactos de columna en los ficheros del INAEM (tal y como los devuelve
 * el parser, con acentos). Centralizados aquí para que el mapeo fila->entidad
 * no disperse strings mágicos.
 */

// Acciones (.xlsx). La 1ª columna (Estado) no tiene cabecera -> el parser la
// nombra COL_1; se accede vía headers[0] desde el servicio.
export const ACCIONES = {
  FILE_NUMBER: "N.Exp.",
  COURSE_NAME: "Curso",
  START: "Inicio",
  END: "Fin",
  HOURS: "Horas",
  GESTOR: "Gestor",
} as const;

// Comunes a Alumnos y Preinscripciones (.xls HTML).
export const COMMON = {
  FILE_NUMBER: "N.Expediente",
  DNI: "NIF/NIE",
  SURNAME1: "APELLIDO1",
  SURNAME2: "APELLIDO2",
  NAME: "NOMBRE",
  ADDRESS: "DIRECCIÓN",
  POSTAL_CODE: "CP",
  CITY: "LOCALIDAD",
  PROVINCE: "PROVINCIA",
  PHONE_LANDLINE: "TELÉFONO FIJO",
  PHONE_MOBILE: "TELÉFONO MOVIL",
  EMAIL: "EMAIL",
  GENDER: "SEXO",
  BIRTH_DATE: "F.NACIMIENTO",
  DISABILITY: "DISCAPACIDAD",
  STUDIES: "ESTUDIOS",
} as const;

export const ALUMNOS = { FINALIZED: "FINALIZADO" } as const;
export const PREINSCRIPCIONES = { PRIORITY: "Prioritaria" } as const;

/**
 * Campos que se vuelcan concatenados a user.observations (bloque por expediente),
 * sólo si tienen valor. Excluidos a propósito: Revisada, Correo no seleccionado, NSS.
 * Algunos sólo existen en Preinscripciones (DISPONIBILIDAD HORARIA, HORARIO); si la
 * columna no está en el fichero, simplemente se omite.
 */
export const OBSERVATION_FIELD_HEADERS: string[] = [
  "SITUACIÓN ACTIVO",
  "EMPRESA",
  "CIF EMPRESA",
  "DOMICILIO EMPRESA",
  "CP EMPRESA",
  "LOCALIDAD EMPRESA",
  "PROVINCIA EMPRESA",
  "N.EMPLEADOS",
  "PYME",
  "SECTOR CONVENIO",
  "AREA FUNCIONAL",
  "CATEGORIA",
  "DISPONIBILIDAD HORARIA",
  "HORARIO",
];
