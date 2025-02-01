import { Dayjs } from "dayjs";
import { CourseModality } from "./course-modality.enum";

export type Course = {
    id_course: number;
    course_name: string;
    moodle_id: number;
    category: string;
    short_name: string;
    start_date: Dayjs;
    end_date: Dayjs;
    modality: CourseModality;
}
