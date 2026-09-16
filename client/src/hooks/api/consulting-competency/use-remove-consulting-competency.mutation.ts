import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useRemoveConsultingCompetencyMutation = () => {
    const request = useAuthenticatedAxios();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id_competency: number) => (await request({
            method: 'DELETE',
            url: `${getApiHost()}/api/consultoria/competencies/${id_competency}`,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-competencies', 'get-all'] });
            queryClient.invalidateQueries({ queryKey: ['consulting-competency-template'] });
            queryClient.invalidateQueries({ queryKey: ['consulting-competency-roster'] });
        },
    });
};
