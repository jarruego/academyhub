import { CourseModality } from "../course/course-modality.enum";

// CONVOCADO y MATRICULADO son derivados: solo los asigna el servidor
// (incorporar a una edición / matricular la candidatura vinculada). El
// editor manual (course-interests-section.tsx) no permite seleccionarlos.
export type InterestStatus = "INTERESADO" | "CONTACTADO" | "CONVOCADO" | "MATRICULADO" | "DESCARTADO";
export type InterestSource = "TELEFONO" | "WEB" | "PRESENCIAL" | "CENTRO" | "IMPORTACION" | "OTRO";

export interface CourseInterest {
  id_interest: number;
  id_catalog_course: number;
  id_user: number;
  status: InterestStatus;
  interest_date: string;
  source: InterestSource | null;
  preferred_modality: CourseModality | null;
  availability: string | null;
  notes: string | null;
  assigned_to: number | null;
  closed_at: string | null;
  name: string;
  first_surname: string | null;
  second_surname: string | null;
  dni: string | null;
  phone: string | null;
  email: string | null;
  catalog_course_name: string;
  assigned_to_username: string | null;
}

export type CreateCourseInterestInput = (
  Pick<CourseInterest, "id_catalog_course"> & Partial<Pick<CourseInterest, "source" | "preferred_modality" | "availability" | "notes" | "assigned_to">>
) & (
  | { id_user: number; new_user?: undefined }
  | { id_user?: undefined; new_user: { name: string; first_surname?: string; second_surname?: string; dni?: string; phone?: string; email?: string } }
);

export type CourseInterestPatch = Pick<CourseInterest, "id_interest"> &
  Partial<Pick<CourseInterest, "status" | "source" | "preferred_modality" | "availability" | "notes" | "assigned_to">>;
