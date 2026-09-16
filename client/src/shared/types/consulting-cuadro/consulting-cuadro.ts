// Cuadro de formación por centro: cruce trabajador × acción — ver docs/consultoria.md.
export type ConsultingRosterMember = {
    id_user: number;
    name: string;
    first_surname: string | null;
    second_surname: string | null;
    dni: string | null;
    job_position: string | null;
    source: 'real' | 'added';
};

export type ConsultingRosterAdjustment = {
    id_roster_adjustment: number;
    id_user: number;
    name: string;
    first_surname: string | null;
    second_surname: string | null;
    dni: string | null;
    job_position: string | null;
    adjustment_type: 'ADD' | 'REMOVE';
};

export type ConsultingRosterOverview = {
    year: number;
    members: ConsultingRosterMember[];
    adjustments: ConsultingRosterAdjustment[];
};

export type ConsultingCuadroRow = {
    id_user: number;
    name: string;
    first_surname: string | null;
    second_surname: string | null;
    dni: string | null;
    job_position: string | null;
    id_catalog_course: number;
    action_name: string;
    attended_at: string;
    source: 'real' | 'manual';
    id_action_attendee?: number;
    finalized?: boolean;
};

export type ConsultingCuadroOverview = {
    year: number;
    rows: ConsultingCuadroRow[];
};

export type CreateConsultingActionAttendee = {
    id_catalog_course: number;
    id_user: number;
    attended_at: string;
};
