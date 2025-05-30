import { CourseModality } from "./course-modality.enum";

export type Course = {
    id_course: number;
    course_name: string;
    moodle_id: number;
    category: string;
    short_name: string;
    start_date: Date | null;
    end_date: Date | null;
    modality: CourseModality;
    hours: number;
    price_per_hour: number; 
    fundae_id: string;
    active: boolean;
}
