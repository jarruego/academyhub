import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingJobPosition } from "../../../shared/types/consulting-job-position/consulting-job-position";

export const useCreateConsultingJobPositionMutation = () => {
    const request = useAuthenticatedAxios<ConsultingJobPosition>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { name: string; id_job_position_group?: number | null; display_order?: number }) => (await request({
            method: 'POST',
            url: `${getApiHost()}/api/consultoria/job-positions`,
            data,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-job-positions', 'get-all'] });
        },
    });
};
