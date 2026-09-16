import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

// TEMPORAL — botón "Automapear puestos de trabajo" de la bandeja de puestos
// sin mapear. Borrar junto con el resto de la funcionalidad de autorrelleno
// cuando el usuario avise de que ya no hace falta. Ver
// server/src/api/consultoria/consultoria-catalog-seed.data.ts.
export const useAutoMapConsultingJobPositionsMutation = () => {
    const request = useAuthenticatedAxios<{ mapped: number; unresolved: string[]; garbage: string[] }>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => (await request({
            method: 'POST',
            url: `${getApiHost()}/api/consultoria/catalog-seed/automap-job-positions`,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-job-position-aliases'] });
        },
    });
};
