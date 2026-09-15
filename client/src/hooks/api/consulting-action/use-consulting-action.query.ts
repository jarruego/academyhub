import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingAction } from "../../../shared/types/consulting-action/consulting-action";

export const useConsultingActionQuery = (id_catalog_course: string, options?: { enabled?: boolean }) => {
    const request = useAuthenticatedAxios<ConsultingAction>();

    return useQuery({
        queryKey: ['consulting-action', id_catalog_course],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/actions/${id_catalog_course}`
        })).data,
        // 404 esperado mientras el curso todavía no está etiquetado — no reintentar.
        retry: false,
        enabled: options?.enabled ?? !!id_catalog_course,
    });
};
