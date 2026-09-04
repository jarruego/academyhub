import { CourseModality } from "./course-modality.enum";
import { CourseClient } from "./course-client.enum";
import { CourseFunding } from "./course-funding.enum";

export type Course = {
    id_course: number;
    id_catalog_course: number;
    catalog_course_name?: string;
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
    // Cliente/comitente (INAEM/VITALIA/OTRO). El ámbito se deriva de funding.
    client?: CourseClient | null;
    // Financiación: ¿cómo se paga? (PRIVADA/FUNDAE/PUBLICA).
    funding?: CourseFunding | null;
    // Curso provisional autocreado por la importación INAEM (a completar).
    is_provisional?: boolean | null;
    active?: boolean | null;
    moodle_synced_at?: Date | null;
    capacity?: number | null;
    selection_at?: Date | null;
    selection_place?: string | null;
    training_place?: string | null;
    target_audience?: string | null;
    admission_requirements?: string | null;
    required_documentation?: string | null;
    planned_schedule?: string | null;
    coordinator?: string | null;
    organization_notes?: string | null;
}
