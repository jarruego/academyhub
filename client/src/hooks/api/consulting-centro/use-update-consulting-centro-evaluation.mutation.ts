import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConsultingCentroAxios } from "../../../utils/api/use-consulting-centro-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingActionEvaluation, UpdateConsultingActionEvaluation } from "../../../shared/types/consulting-action-evaluation/consulting-action-evaluation";

export const useUpdateConsultingCentroEvaluationMutation = (id_annual_engagement: number) => {
    const request = useConsultingCentroAxios<ConsultingActionEvaluation>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id_action_evaluation, data }: { id_action_evaluation: number; data: UpdateConsultingActionEvaluation }) => (await request({
            method: 'PATCH',
            url: `${getApiHost()}/api/consultoria/centro/engagements/${id_annual_engagement}/evaluations/${id_action_evaluation}`,
            data,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-centro-evaluations', id_annual_engagement] });
        },
    });
};
