// Fila del plan de formación de una consultoría anual concreta — propio de
// cada ejercicio, no compartido entre años (ver docs/consultoria.md).
// id_center null = plan base, compartido por los centros que participan en
// esa consultoría.
export type ConsultingPlanItem = {
    id_plan_item: number;
    id_consulting_client: number;
    id_annual_engagement: number;
    id_center: number | null;
    center_name: string | null;
    id_catalog_course: number;
    name: string;
    hours?: number | null;
    modality?: string | null;
    origin?: string | null;
    category_name?: string | null;
    planning_date_name?: string | null;
    added_by: number | null;
    added_at: string;
};

export type CreateConsultingPlanItem = {
    id_center?: number | null;
    id_catalog_course: number;
};
