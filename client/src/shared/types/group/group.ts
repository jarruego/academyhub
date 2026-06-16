import type { GroupActiveMode } from "../../../utils/group-active.util";

export type Group = {
    id_group: number;
    moodle_id?: number | null;
    group_name: string;
    id_course: number;
    description?: string | null;
    start_date?: Date | null;
    end_date?: Date | null;
    active_mode?: GroupActiveMode | null;
    fundae_id?: string | null;
    moodle_synced_at?: Date | null;
}