import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConsultingCentroAxios } from "../../../utils/api/use-consulting-centro-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useSetConsultingCentroCompetencyMutation = (id_annual_engagement: number) => {
    const request = useConsultingCentroAxios();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id_user, id_competency, value }: { id_user: number; id_competency: number; value: boolean | null }) => (await request({
            method: 'PUT',
            url: `${getApiHost()}/api/consultoria/centro/engagements/${id_annual_engagement}/competencies/${id_user}/${id_competency}`,
            data: { value },
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-centro-competencies', id_annual_engagement] });
        },
    });
};
