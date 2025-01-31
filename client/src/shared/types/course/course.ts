import { Dayjs } from "dayjs";

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

export enum CourseModality {
    ONLINE = 'Online',
    PRESENTIAL = 'Presential',
    MIXED = 'Mixed'
}