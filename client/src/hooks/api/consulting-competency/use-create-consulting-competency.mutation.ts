import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingCompetency } from "../../../shared/types/consulting-competency/consulting-competency";

export const useCreateConsultingCompetencyMutation = () => {
    const request = useAuthenticatedAxios<ConsultingCompetency>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { name: string; display_order?: number }) => (await request({
            method: 'POST',
            url: `${getApiHost()}/api/consultoria/competencies`,
            data,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-competencies', 'get-all'] });
            // Una competencia nueva cambia también la plantilla del puesto que se esté viendo (fila nueva, sin valor todavía) y el roster de evaluación de cualquier centro abierto.
            queryClient.invalidateQueries({ queryKey: ['consulting-competency-template'] });
            queryClient.invalidateQueries({ queryKey: ['consulting-competency-roster'] });
        },
    });
};
