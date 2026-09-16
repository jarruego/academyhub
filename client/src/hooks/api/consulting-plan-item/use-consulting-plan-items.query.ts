import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingPlanItem } from "../../../shared/types/consulting-plan-item/consulting-plan-item";

export const useConsultingPlanItemsQuery = (id_consulting_client: string, id_annual_engagement: string) => {
    const request = useAuthenticatedAxios<ConsultingPlanItem[]>();

    return useQuery({
        queryKey: ['consulting-plan-items', id_consulting_client, id_annual_engagement],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/clients/${id_consulting_client}/annual-engagements/${id_annual_engagement}/plan-items`
        })).data,
        enabled: !!id_annual_engagement,
    });
};
