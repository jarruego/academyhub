import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConsultingCentroAxios } from "../../../utils/api/use-consulting-centro-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useRemoveConsultingCentroEvaluationMutation = (id_annual_engagement: number) => {
    const request = useConsultingCentroAxios<{ success: boolean }>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id_action_evaluation: number) => (await request({
            method: 'DELETE',
            url: `${getApiHost()}/api/consultoria/centro/engagements/${id_annual_engagement}/evaluations/${id_action_evaluation}`,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-centro-evaluations', id_annual_engagement] });
        },
    });
};
