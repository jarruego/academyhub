import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useAddConsultingPlanItemToAllCentersMutation = (id_consulting_client: string) => {
    const request = useAuthenticatedAxios();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id_catalog_course: number) => (await request({
            method: 'POST',
            url: `${getApiHost()}/api/consultoria/clients/${id_consulting_client}/plan-items/all-centers`,
            data: { id_catalog_course },
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-plan-items', id_consulting_client] });
        },
    });
};
