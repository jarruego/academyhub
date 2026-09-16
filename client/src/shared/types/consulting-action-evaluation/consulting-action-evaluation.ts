// Evaluación de una acción formativa del plan de un centro — ver docs/consultoria.md.
export type ConsultingActionEvaluation = {
    id_action_evaluation: number;
    id_catalog_course: number;
    name: string;
    id_center: number;
    id_annual_engagement: number;
    evaluation_date: string;
    evaluation_text: string | null;
    percentage: number | null;
    imparte_text: string | null;
    evaluated_by: number | null;
    createdAt: string;
};

export type CreateConsultingActionEvaluation = {
    id_catalog_course: number;
    evaluation_date: string;
    evaluation_text?: string;
    percentage?: number;
    imparte_text?: string;
};

export type UpdateConsultingActionEvaluation = Partial<Omit<CreateConsultingActionEvaluation, 'id_catalog_course'>>;
