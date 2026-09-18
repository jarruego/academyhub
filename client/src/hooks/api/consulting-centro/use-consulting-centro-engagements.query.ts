import { useQuery } from "@tanstack/react-query";
import { useConsultingCentroAxios } from "../../../utils/api/use-consulting-centro-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingCentroEngagement } from "../../../shared/types/consulting-centro/consulting-centro";

export const useConsultingCentroEngagementsQuery = () => {
    const request = useConsultingCentroAxios<ConsultingCentroEngagement[]>();

    return useQuery({
        queryKey: ['consulting-centro-engagements'],
        // Sin reintentos: un 401 aquí (token revocado/inválido) es
        // definitivo — decide si se muestra "Enlace no válido"
        // (ConsultingCentroEngagementsRoute), reintentar solo lo retrasa.
        retry: false,
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/centro/engagements`,
        })).data,
    });
};
