import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingJobPositionGroup } from "../../../shared/types/consulting-job-position/consulting-job-position";

export const useCreateConsultingJobPositionGroupMutation = () => {
    const request = useAuthenticatedAxios<ConsultingJobPositionGroup>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { name: string; display_order?: number }) => (await request({
            method: 'POST',
            url: `${getApiHost()}/api/consultoria/job-position-groups`,
            data,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-job-position-groups', 'get-all'] });
        },
    });
};
