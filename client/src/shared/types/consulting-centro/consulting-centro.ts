// Acceso externo del centro — ver docs/consultoria.md.
export type ConsultingCentroEngagement = {
    id_annual_engagement: number;
    id_consulting_client: number;
    client_name: string;
    year: number;
    status: 'OPEN' | 'CLOSED';
};

export type ConsultingCentroAction = {
    id_catalog_course: number;
    name: string;
    origin?: string | null;
};
