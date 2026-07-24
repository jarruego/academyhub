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

export type CourseRequestStats = {
  byCourse: CourseRequestStatsByCourse[];
  // Nº de peticiones por curso y empresa (pivote de columnas por empresa en "Por curso").
  byCourseCompany: CourseRequestStatsByCourseCompany[];
};
