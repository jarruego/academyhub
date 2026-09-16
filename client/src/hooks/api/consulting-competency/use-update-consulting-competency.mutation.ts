import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingCompetency } from "../../../shared/types/consulting-competency/consulting-competency";

export const useUpdateConsultingCompetencyMutation = () => {
    const request = useAuthenticatedAxios<ConsultingCompetency>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id_competency, ...data }: { id_competency: number; name?: string; display_order?: number }) => (await request({
            method: 'PATCH',
            url: `${getApiHost()}/api/consultoria/competencies/${id_competency}`,
            data,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-competencies', 'get-all'] });
        },
    });
};
