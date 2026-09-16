import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useRemoveConsultingJobPositionAliasMutation = () => {
    const request = useAuthenticatedAxios();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id_job_position_alias: number) => (await request({
            method: 'DELETE',
            url: `${getApiHost()}/api/consultoria/job-position-aliases/${id_job_position_alias}`,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-job-position-aliases'] });
        },
    });
};
