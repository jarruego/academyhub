import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useSetConsultingRosterAdjustmentMutation = (id_consulting_client: string, id_annual_engagement: string, id_center: string) => {
    const request = useAuthenticatedAxios();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id_user, adjustment_type }: { id_user: number; adjustment_type: 'ADD' | 'REMOVE' }) => (await request({
            method: 'PUT',
            url: `${getApiHost()}/api/consultoria/clients/${id_consulting_client}/annual-engagements/${id_annual_engagement}/centers/${id_center}/roster/${id_user}`,
            data: { adjustment_type },
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-roster', id_consulting_client, id_annual_engagement, id_center] });
        },
    });
};
