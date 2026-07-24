export type CourseRequestReportRow = {
  id_company: number | null;
  company_name: string | null;
  id_center: number | null;
  center_name: string | null;
  id_course: number;
  course_name: string;
  request_count: number;
  student_count: number;
};

export type CourseRequestReportFilters = {
  // Selección múltiple: ver resultados de varias empresas a la vez.
  id_company?: number[];
  id_center?: number;
  id_course?: number;
};
