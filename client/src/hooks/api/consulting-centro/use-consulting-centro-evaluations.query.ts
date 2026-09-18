import { useQuery } from "@tanstack/react-query";
import { useConsultingCentroAxios } from "../../../utils/api/use-consulting-centro-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingActionEvaluation } from "../../../shared/types/consulting-action-evaluation/consulting-action-evaluation";

export const useConsultingCentroEvaluationsQuery = (id_annual_engagement: number) => {
    const request = useConsultingCentroAxios<ConsultingActionEvaluation[]>();

    return useQuery({
        queryKey: ['consulting-centro-evaluations', id_annual_engagement],
        enabled: Number.isFinite(id_annual_engagement),
        // Sin reintentos: esta consulta decide si se muestra "Sin acceso"
        // (ConsultingCentroEngagementRoute) — un 404 aquí es definitivo (el
        // centro no participa en esta consultoría), reintentar solo retrasa
        // varios segundos ese aviso sin cambiar el resultado.
        retry: false,
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/centro/engagements/${id_annual_engagement}/evaluations`,
        })).data,
    });
};
