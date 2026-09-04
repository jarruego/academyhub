export type CandidateSource = "MANUAL" | "EXCEL_OPERATIVO" | "INTERES_CURSO" | "IMPORTACION_INAEM";
export type CandidateProcessStatus = "PENDIENTE" | "SELECCIONADA" | "RESERVA" | "BAJA" | "DESCARTADA";
export type CandidateEmploymentStatus = "DESEMPLEO" | "OCUPADO" | "OTRO";
export type CandidateAttendanceStatus = "PENDIENTE" | "SI" | "NO";

export interface CourseCandidate {
  id_candidate: number;
  id_user: number;
  id_course: number;
  source: CandidateSource;
  process_status: CandidateProcessStatus;
  employment_status: CandidateEmploymentStatus | null;
  meets_requirements: boolean | null;
  attendance_status: CandidateAttendanceStatus;
  has_darde: boolean;
  has_dni: boolean;
  has_titulacion: boolean;
  operational_notes: string | null;
  assigned_to: number | null;
  name: string;
  first_surname: string | null;
  second_surname: string | null;
  dni: string | null;
  phone: string | null;
  email: string | null;
  inaem_status: "PREINSCRITO" | "MATRICULADO" | "DESCARTADO" | "BAJA" | null;
  prioritaria: boolean | null;
  registration_source: "IMPORTACION_INAEM" | "CONFIRMACION_MANUAL" | null;
  registered_at: string | null;
  verified_at: string | null;
  last_imported_at: string | null;
  assigned_to_username: string | null;
}

export type CourseCandidatePatch = Pick<CourseCandidate, "id_candidate"> & Partial<Pick<CourseCandidate,
  "process_status" | "employment_status" | "meets_requirements" |
  "attendance_status" | "has_darde" | "has_dni" | "has_titulacion" |
  "operational_notes" | "assigned_to"
>>;
