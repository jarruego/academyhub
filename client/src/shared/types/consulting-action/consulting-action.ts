export type ConsultingActionOrigin = 'OWN' | 'EXTERNAL';

// Etiqueta de Consultoría sobre un curso de catálogo. name/hours/modality/
// objectives/target_audience vienen de catalog_courses (no duplicados aquí)
// — ver docs/consultoria.md.
export type ConsultingAction = {
    id_catalog_course: number;
    origin: ConsultingActionOrigin;
    id_category?: number | null;
    category_name?: string | null;
    id_planning_date?: number | null;
    planning_date_name?: string | null;
    name: string;
    hours?: number | null;
    modality?: string | null;
    objectives?: string | null;
    target_audience?: string | null;
};

export type UpsertConsultingAction = {
    origin: ConsultingActionOrigin;
    id_category?: number;
    id_planning_date?: number;
};
