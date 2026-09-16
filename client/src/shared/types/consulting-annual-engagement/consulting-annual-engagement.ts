// Consultoría anual: una por cliente y ejercicio — no "auditoría", eso lo
// reciben los centros/clientes de un tercero (ISO/SGE21/...); esto es
// nuestra herramienta para prepararlos. Los centros participantes son una
// simple lista de pertenencia, sin ciclo de vida propio — ver docs/consultoria.md.
export type ConsultingEngagementStatusValue = 'OPEN' | 'CLOSED';

export type ConsultingAnnualEngagement = {
    id_annual_engagement: number;
    id_consulting_client: number;
    year: number;
    status: ConsultingEngagementStatusValue;
    opened_at: string;
    closed_at: string | null;
    created_by: number | null;
};

export type OpenConsultingAnnualEngagement = {
    year: number;
    id_centers?: number[];
};

export type ConsultingEngagementCenter = {
    id_engagement_center: number;
    id_center: number;
    center_name: string;
};
