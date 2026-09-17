import { useQuery } from "@tanstack/react-query";
import { useConsultingCentroAxios } from "../../../utils/api/use-consulting-centro-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingRosterOverview } from "../../../shared/types/consulting-cuadro/consulting-cuadro";

export const useConsultingCentroRosterQuery = (id_annual_engagement: number) => {
    const request = useConsultingCentroAxios<ConsultingRosterOverview>();

    return useQuery({
        queryKey: ['consulting-centro-roster', id_annual_engagement],
        enabled: Number.isFinite(id_annual_engagement),
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/centro/engagements/${id_annual_engagement}/roster`,
        })).data,
    });
};
