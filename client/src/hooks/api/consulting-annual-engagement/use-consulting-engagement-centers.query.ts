import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingEngagementCenter } from "../../../shared/types/consulting-annual-engagement/consulting-annual-engagement";

export const useConsultingEngagementCentersQuery = (id_consulting_client: string, id_annual_engagement: string) => {
    const request = useAuthenticatedAxios<ConsultingEngagementCenter[]>();

    return useQuery({
        queryKey: ['consulting-engagement-centers', id_consulting_client, id_annual_engagement],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/clients/${id_consulting_client}/annual-engagements/${id_annual_engagement}/centers`
        })).data,
        enabled: !!id_annual_engagement,
    });
};
