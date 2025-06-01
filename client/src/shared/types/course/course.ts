import { CourseModality } from "./course-modality.enum";

export type Course = {
    id_course: number;
    course_name: string;
    moodle_id?: number | null;
    category?: string | null;
    short_name: string;
    start_date?: Date | null;
    end_date?: Date | null;
    modality: CourseModality;
    hours?: number | null;
    price_per_hour?: number | null; 
    fundae_id?: string | null;
    active?: boolean | null;
}
