import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingPlanningDate } from "../../../shared/types/consulting-planning-date/consulting-planning-date";

export const useCreateConsultingPlanningDateMutation = () => {
    const request = useAuthenticatedAxios<ConsultingPlanningDate>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (name: string) => (await request({
            method: 'POST',
            url: `${getApiHost()}/api/consultoria/planning-dates`,
            data: { name },
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-planning-dates', 'get-all'] });
        },
    });
};
