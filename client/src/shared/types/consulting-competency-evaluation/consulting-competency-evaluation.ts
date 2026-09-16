export type ConsultingCompetencyValue = {
    id_competency: number;
    value: boolean | null;
    source: 'evaluated' | 'template' | 'blank';
};

export type ConsultingCompetencyRosterMember = {
    id_user: number;
    name: string;
    first_surname?: string | null;
    second_surname?: string | null;
    dni?: string | null;
    job_position?: string | null;
    id_job_position: number | null;
    source: 'real' | 'added';
    values: ConsultingCompetencyValue[];
};

export type ConsultingCompetencyRoster = {
    year: number;
    competencies: { id_competency: number; name: string; display_order?: number | null }[];
    members: ConsultingCompetencyRosterMember[];
};
