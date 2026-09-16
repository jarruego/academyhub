import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingAnnualEngagement } from "../../../shared/types/consulting-annual-engagement/consulting-annual-engagement";

export const useConsultingAnnualEngagementsQuery = (id_consulting_client: string) => {
    const request = useAuthenticatedAxios<ConsultingAnnualEngagement[]>();

    return useQuery({
        queryKey: ['consulting-annual-engagements', id_consulting_client],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/clients/${id_consulting_client}/annual-engagements`
        })).data,
    });
};
