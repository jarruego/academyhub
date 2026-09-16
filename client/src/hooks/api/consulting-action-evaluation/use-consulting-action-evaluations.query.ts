import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingActionEvaluation } from "../../../shared/types/consulting-action-evaluation/consulting-action-evaluation";

export const useConsultingActionEvaluationsQuery = (id_consulting_client: string, id_annual_engagement: string, id_center: string) => {
    const request = useAuthenticatedAxios<ConsultingActionEvaluation[]>();

    return useQuery({
        queryKey: ['consulting-action-evaluations', id_consulting_client, id_annual_engagement, id_center],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/clients/${id_consulting_client}/annual-engagements/${id_annual_engagement}/centers/${id_center}/evaluations`
        })).data,
        enabled: !!id_annual_engagement && !!id_center,
    });
};
