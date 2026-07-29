import { CourseRequestStatus } from "./course-request-status.enum";

export type CourseRequestSource = "EXCEL" | "MANUAL";

export type CourseRequest = {
  id_request: number;
  id_center: number | null;
  id_course: number;
  // Fecha de la petición (yyyy-mm-dd). Por defecto la fecha de alta, editable.
  request_date: string;
  contact_email: string | null;
  is_urgent: boolean;
  status: CourseRequestStatus;
  source: CourseRequestSource;
  notes: string | null;
  created_by: number | null;
  closed_at: string | null;
  createdAt: string;
  updatedAt: string;
  center_name: string | null;
  center_contact_email: string | null;
  id_company: number | null;
  company_name: string | null;
  course_name: string;
  student_count: number;
  // Alumnos que siguen de verdad en un grupo ahora mismo (calculado al vuelo
  // por DNI contra la matrícula real, no solo "tiene id_group" — un alumno
  // dado de baja del grupo sin liberar todavía NO cuenta aquí). Distinto del
  // total histórico (student_count); si no coinciden, la petición está
  // "parcial" (algunos colocados, otros no o ya no), esté abierta o cerrada.
  in_group_student_count: number;
  // Grupos a los que ya se ha matriculado algún alumno de esta petición
  // (derivado de course_request_students.id_group, ver assignStudentsToGroup).
  groups: { id_group: number; group_name: string }[];
};

export type CourseRequestStudent = {
  id: number;
  id_request: number;
  row_order: number;
  name: string;
  first_surname: string;
  second_surname: string | null;
  dni: string;
  email: string;
  phone_mobile: string | null;
  // Grupo al que se matriculó este alumno concreto (null = aún sin matricular).
  id_group: number | null;
  // Si tiene id_group: si sigue realmente en ese grupo ahora mismo (calculado
  // al vuelo por DNI, no es un flag guardado — ver docs/course-requests.md).
  currently_in_group: boolean;
};

export type CourseRequestDetail = CourseRequest & { students: CourseRequestStudent[] };

export type CourseRequestStudentInput = {
  name: string;
  first_surname: string;
  second_surname?: string | null;
  dni: string;
  email: string;
  phone_mobile?: string | null;
};

// Agregados del pivote "Por curso", calculados en cliente a partir de las
// peticiones ya filtradas (curso/centro/estado/empresa) — así el pivote
// siempre refleja los filtros activos en pantalla (ver course-requests.route.tsx).
export type CourseRequestStatsByCourse = {
  id_course: number;
  course_name: string;
  request_count: number;
  student_count: number;
};

export type CourseRequestStatsByCourseCompany = {
  id_course: number;
  id_company: number;
  company_name: string;
  request_count: number;
  student_count: number;
};
