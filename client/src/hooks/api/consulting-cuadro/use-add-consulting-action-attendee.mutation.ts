import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { CreateConsultingActionAttendee } from "../../../shared/types/consulting-cuadro/consulting-cuadro";

export const useAddConsultingActionAttendeeMutation = (id_consulting_client: string, id_annual_engagement: string, id_center: string) => {
    const request = useAuthenticatedAxios();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateConsultingActionAttendee) => (await request({
            method: 'POST',
            url: `${getApiHost()}/api/consultoria/clients/${id_consulting_client}/annual-engagements/${id_annual_engagement}/centers/${id_center}/attendees`,
            data,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-cuadro', id_consulting_client, id_annual_engagement, id_center] });
        },
    });
};
