import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConsultingCentroAxios } from "../../../utils/api/use-consulting-centro-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useRemoveConsultingCentroAttendeeMutation = (id_annual_engagement: number) => {
    const request = useConsultingCentroAxios();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id_action_attendee: number) => (await request({
            method: 'DELETE',
            url: `${getApiHost()}/api/consultoria/centro/engagements/${id_annual_engagement}/attendees/${id_action_attendee}`,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-centro-cuadro', id_annual_engagement] });
        },
    });
};
