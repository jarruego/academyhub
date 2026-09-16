import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { OpenConsultingAnnualEngagement } from "../../../shared/types/consulting-annual-engagement/consulting-annual-engagement";

export const useOpenConsultingAnnualEngagementMutation = (id_consulting_client: string) => {
    const request = useAuthenticatedAxios();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: OpenConsultingAnnualEngagement) => (await request({
            method: 'POST',
            url: `${getApiHost()}/api/consultoria/clients/${id_consulting_client}/annual-engagements`,
            data,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-annual-engagements', id_consulting_client] });
        },
    });
};
