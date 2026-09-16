export type ConsultingJobPositionGroup = {
    id_job_position_group: number;
    name: string;
    display_order?: number | null;
};

export type ConsultingJobPosition = {
    id_job_position: number;
    name: string;
    id_job_position_group: number | null;
    group_name?: string | null;
    display_order?: number | null;
};

export type ConsultingJobPositionAlias = {
    id_job_position_alias: number;
    job_position: string;
    id_job_position: number;
    job_position_name: string;
};

export type ConsultingCompetencyTemplateEntry = {
    id_competency: number;
    name: string;
    default_value: boolean | null;
};
