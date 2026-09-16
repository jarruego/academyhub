import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useRemoveConsultingRosterAdjustmentMutation = (id_consulting_client: string, id_annual_engagement: string, id_center: string) => {
    const request = useAuthenticatedAxios();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id_roster_adjustment: number) => (await request({
            method: 'DELETE',
            url: `${getApiHost()}/api/consultoria/clients/${id_consulting_client}/annual-engagements/${id_annual_engagement}/centers/${id_center}/roster/adjustments/${id_roster_adjustment}`,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-roster', id_consulting_client, id_annual_engagement, id_center] });
        },
    });
};
