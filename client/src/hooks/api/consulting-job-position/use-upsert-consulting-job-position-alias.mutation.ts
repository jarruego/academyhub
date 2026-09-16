import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingJobPositionAlias } from "../../../shared/types/consulting-job-position/consulting-job-position";

export const useUpsertConsultingJobPositionAliasMutation = () => {
    const request = useAuthenticatedAxios<ConsultingJobPositionAlias>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { job_position: string; id_job_position: number }) => (await request({
            method: 'POST',
            url: `${getApiHost()}/api/consultoria/job-position-aliases`,
            data,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-job-position-aliases'] });
        },
    });
};
