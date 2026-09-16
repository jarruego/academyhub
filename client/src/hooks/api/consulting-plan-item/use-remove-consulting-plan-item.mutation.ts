import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useRemoveConsultingPlanItemMutation = (id_consulting_client: string, id_annual_engagement: string) => {
    const request = useAuthenticatedAxios();
    const queryClient = useQueryClient();

    return useMutation({
        // keepForCenters (solo tiene efecto en un ítem del plan base): reparte una
        // copia propia a cada centro antes de borrar la fila base, en vez de
        // bloquear/borrar del todo.
        mutationFn: async ({ id_plan_item, keepForCenters }: { id_plan_item: number; keepForCenters?: boolean }) => (await request({
            method: 'DELETE',
            url: `${getApiHost()}/api/consultoria/clients/${id_consulting_client}/annual-engagements/${id_annual_engagement}/plan-items/${id_plan_item}`,
            params: keepForCenters ? { keep_for_centers: 'true' } : undefined,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-plan-items', id_consulting_client, id_annual_engagement] });
        },
    });
};
