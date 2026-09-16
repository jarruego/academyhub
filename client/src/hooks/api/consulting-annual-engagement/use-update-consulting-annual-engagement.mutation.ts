import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingEngagementStatusValue } from "../../../shared/types/consulting-annual-engagement/consulting-annual-engagement";

export const useUpdateConsultingAnnualEngagementMutation = (id_consulting_client: string) => {
    const request = useAuthenticatedAxios();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id_annual_engagement, status }: { id_annual_engagement: number; status: ConsultingEngagementStatusValue }) => (await request({
            method: 'PATCH',
            url: `${getApiHost()}/api/consultoria/clients/${id_consulting_client}/annual-engagements/${id_annual_engagement}`,
            data: { status },
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-annual-engagements', id_consulting_client] });
        },
    });
};
