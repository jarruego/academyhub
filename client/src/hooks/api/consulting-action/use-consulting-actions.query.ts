import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingAction } from "../../../shared/types/consulting-action/consulting-action";

export const useConsultingActionsQuery = () => {
    const request = useAuthenticatedAxios<ConsultingAction[]>();

    return useQuery({
        queryKey: ['consulting-actions', 'get-all'],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/actions`
        })).data,
    });
};
