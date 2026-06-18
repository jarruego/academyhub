import { CourseModality } from "./course-modality.enum";
import { CourseOrigin } from "./course-origin.enum";

export type Course = {
    id_course: number;
    course_name: string;
    moodle_id?: number | null;
    category?: string | null;
    contents?: string | null;
    short_name: string;
    start_date?: Date | null;
    end_date?: Date | null;
    modality: CourseModality;
    hours?: number | null;
    price_per_hour?: number | null;
    fundae_id?: string | null;
    // Nº de expediente INAEM (matching de importación / etiquetado manual).
    file_number?: string | null;
    // Origen/financiación (CLIENTE/INAEM/PRIVADO/OTRO).
    origin?: CourseOrigin | null;
    // Curso provisional autocreado por la importación INAEM (a completar).
    is_provisional?: boolean | null;
    active?: boolean | null;
    moodle_synced_at?: Date | null;
}
