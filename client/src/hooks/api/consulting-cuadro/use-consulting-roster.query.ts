import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingRosterOverview } from "../../../shared/types/consulting-cuadro/consulting-cuadro";

export const useConsultingRosterQuery = (id_consulting_client: string, id_annual_engagement: string, id_center: string) => {
    const request = useAuthenticatedAxios<ConsultingRosterOverview>();

    return useQuery({
        queryKey: ['consulting-roster', id_consulting_client, id_annual_engagement, id_center],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/clients/${id_consulting_client}/annual-engagements/${id_annual_engagement}/centers/${id_center}/roster`
        })).data,
        enabled: !!id_annual_engagement && !!id_center,
    });
};
