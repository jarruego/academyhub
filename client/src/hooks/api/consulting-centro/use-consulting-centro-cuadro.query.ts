import { useQuery } from "@tanstack/react-query";
import { useConsultingCentroAxios } from "../../../utils/api/use-consulting-centro-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingCuadroOverview } from "../../../shared/types/consulting-cuadro/consulting-cuadro";

export const useConsultingCentroCuadroQuery = (id_annual_engagement: number) => {
    const request = useConsultingCentroAxios<ConsultingCuadroOverview>();

    return useQuery({
        queryKey: ['consulting-centro-cuadro', id_annual_engagement],
        enabled: Number.isFinite(id_annual_engagement),
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/centro/engagements/${id_annual_engagement}/cuadro`,
        })).data,
    });
};
