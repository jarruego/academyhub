import { Dayjs } from "dayjs";

export type Group = {
    id_group: number;
    moodle_id: number;
    group_name: string;
    id_course: number;
    description: string;
    start_date: Dayjs;
    end_date: Dayjs;
    fundae_id: string;
}