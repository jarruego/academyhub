import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingJobPositionGroup } from "../../../shared/types/consulting-job-position/consulting-job-position";

export const useUpdateConsultingJobPositionGroupMutation = () => {
    const request = useAuthenticatedAxios<ConsultingJobPositionGroup>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id_job_position_group, ...data }: { id_job_position_group: number; name?: string; display_order?: number }) => (await request({
            method: 'PATCH',
            url: `${getApiHost()}/api/consultoria/job-position-groups/${id_job_position_group}`,
            data,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-job-position-groups', 'get-all'] });
            queryClient.invalidateQueries({ queryKey: ['consulting-job-positions', 'get-all'] });
        },
    });
};
