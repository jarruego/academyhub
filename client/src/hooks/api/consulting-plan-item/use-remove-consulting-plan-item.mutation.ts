import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useRemoveConsultingPlanItemMutation = (id_consulting_client: string) => {
    const request = useAuthenticatedAxios();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id_plan_item: number) => (await request({
            method: 'DELETE',
            url: `${getApiHost()}/api/consultoria/clients/${id_consulting_client}/plan-items/${id_plan_item}`,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-plan-items', id_consulting_client] });
        },
    });
};
