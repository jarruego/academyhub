import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useSetConsultingCompetencyTemplateMutation = (id_job_position: number | undefined) => {
    const request = useAuthenticatedAxios();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id_competency, default_value }: { id_competency: number; default_value: boolean | null }) => (await request({
            method: 'PUT',
            url: `${getApiHost()}/api/consultoria/job-positions/${id_job_position}/competency-template/${id_competency}`,
            data: { default_value },
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-competency-template', id_job_position] });
        },
    });
};
