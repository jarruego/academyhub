import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useRemoveConsultingJobPositionMutation = () => {
    const request = useAuthenticatedAxios();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id_job_position: number) => (await request({
            method: 'DELETE',
            url: `${getApiHost()}/api/consultoria/job-positions/${id_job_position}`,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-job-positions', 'get-all'] });
            queryClient.invalidateQueries({ queryKey: ['consulting-competency-template'] });
        },
    });
};
