import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { CreateConsultingPlanItem } from "../../../shared/types/consulting-plan-item/consulting-plan-item";

export const useAddConsultingPlanItemMutation = (id_consulting_client: string, id_annual_engagement: string) => {
    const request = useAuthenticatedAxios();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateConsultingPlanItem) => (await request({
            method: 'POST',
            url: `${getApiHost()}/api/consultoria/clients/${id_consulting_client}/annual-engagements/${id_annual_engagement}/plan-items`,
            data,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-plan-items', id_consulting_client, id_annual_engagement] });
        },
    });
};
