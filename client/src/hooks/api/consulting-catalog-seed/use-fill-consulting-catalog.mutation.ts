import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

// TEMPORAL — botón "Autorrellenar catálogo" del Configurador de competencias.
// Borrar junto con el resto de la funcionalidad de autorrelleno cuando el
// usuario avise de que ya no hace falta. Ver server/src/api/consultoria/consultoria-catalog-seed.data.ts.
export const useFillConsultingCatalogMutation = () => {
    const request = useAuthenticatedAxios<{ competenciesCreated: number; jobPositionsCreated: number; templateValuesSet: number }>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => (await request({
            method: 'POST',
            url: `${getApiHost()}/api/consultoria/catalog-seed/fill`,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-competencies', 'get-all'] });
            queryClient.invalidateQueries({ queryKey: ['consulting-job-positions', 'get-all'] });
            queryClient.invalidateQueries({ queryKey: ['consulting-competency-template'] });
        },
    });
};
