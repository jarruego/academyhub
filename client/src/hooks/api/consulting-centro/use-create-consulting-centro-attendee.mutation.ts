import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConsultingCentroAxios } from "../../../utils/api/use-consulting-centro-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { CreateConsultingActionAttendee } from "../../../shared/types/consulting-cuadro/consulting-cuadro";

export const useCreateConsultingCentroAttendeeMutation = (id_annual_engagement: number) => {
    const request = useConsultingCentroAxios();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateConsultingActionAttendee) => (await request({
            method: 'POST',
            url: `${getApiHost()}/api/consultoria/centro/engagements/${id_annual_engagement}/attendees`,
            data,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-centro-cuadro', id_annual_engagement] });
        },
    });
};
