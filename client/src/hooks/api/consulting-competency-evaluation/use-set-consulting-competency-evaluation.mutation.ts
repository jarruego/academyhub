import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useSetConsultingCompetencyEvaluationMutation = (id_consulting_client: string, id_annual_engagement: string, id_center: string) => {
    const request = useAuthenticatedAxios();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id_user, id_competency, value }: { id_user: number; id_competency: number; value: boolean | null }) => (await request({
            method: 'PUT',
            url: `${getApiHost()}/api/consultoria/clients/${id_consulting_client}/annual-engagements/${id_annual_engagement}/centers/${id_center}/competencies/${id_user}/${id_competency}`,
            data: { value },
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-competency-roster', id_consulting_client, id_annual_engagement, id_center] });
        },
    });
};
