import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConsultingCentroAxios } from "../../../utils/api/use-consulting-centro-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingActionEvaluation, CreateConsultingActionEvaluation } from "../../../shared/types/consulting-action-evaluation/consulting-action-evaluation";

export const useCreateConsultingCentroEvaluationMutation = (id_annual_engagement: number) => {
    const request = useConsultingCentroAxios<ConsultingActionEvaluation>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateConsultingActionEvaluation) => (await request({
            method: 'POST',
            url: `${getApiHost()}/api/consultoria/centro/engagements/${id_annual_engagement}/evaluations`,
            data,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-centro-evaluations', id_annual_engagement] });
        },
    });
};
