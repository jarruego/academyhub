import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useRemoveConsultingJobPositionGroupMutation = () => {
    const request = useAuthenticatedAxios();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id_job_position_group: number) => (await request({
            method: 'DELETE',
            url: `${getApiHost()}/api/consultoria/job-position-groups/${id_job_position_group}`,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-job-position-groups', 'get-all'] });
        },
    });
};
