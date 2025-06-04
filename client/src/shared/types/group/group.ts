export type Group = {
    id_group: number;
    moodle_id?: number | null;
    group_name: string;
    id_course: number;
    description?: string | null;
    start_date?: Date | null;
    end_date?: Date | null;
    fundae_id?: string | null;
}