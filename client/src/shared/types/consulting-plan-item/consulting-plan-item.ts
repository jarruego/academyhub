// Fila del plan de formación de un cliente — ver docs/consultoria.md.
// id_center null = plan base, compartido por todos los centros del cliente.
export type ConsultingPlanItem = {
    id_plan_item: number;
    id_consulting_client: number;
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
