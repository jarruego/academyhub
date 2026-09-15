import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingAction, UpsertConsultingAction } from "../../../shared/types/consulting-action/consulting-action";

export const useUpsertConsultingActionMutation = (id_catalog_course: string) => {
    const request = useAuthenticatedAxios<ConsultingAction>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: UpsertConsultingAction) => (await request({
            method: 'PUT',
            url: `${getApiHost()}/api/consultoria/actions/${id_catalog_course}`,
            data,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-actions', 'get-all'] });
            queryClient.invalidateQueries({ queryKey: ['consulting-action', id_catalog_course] });
        },
    });
};
