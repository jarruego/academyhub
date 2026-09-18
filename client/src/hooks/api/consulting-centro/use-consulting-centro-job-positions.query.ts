import { useQuery } from "@tanstack/react-query";
import { useConsultingCentroAxios } from "../../../utils/api/use-consulting-centro-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingJobPosition } from "../../../shared/types/consulting-job-position/consulting-job-position";

// Catálogo de puestos de trabajo, para el picker de mapeo dentro de la
// evaluación de competencias del propio centro (acceso externo por token).
export const useConsultingCentroJobPositionsQuery = (id_annual_engagement: number) => {
    const request = useConsultingCentroAxios<ConsultingJobPosition[]>();

    return useQuery({
        queryKey: ['consulting-centro-job-positions', id_annual_engagement],
        enabled: Number.isFinite(id_annual_engagement),
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/centro/engagements/${id_annual_engagement}/job-positions`,
        })).data,
    });
};
