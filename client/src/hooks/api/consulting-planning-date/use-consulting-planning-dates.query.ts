import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingPlanningDate } from "../../../shared/types/consulting-planning-date/consulting-planning-date";

export const useConsultingPlanningDatesQuery = () => {
    const request = useAuthenticatedAxios<ConsultingPlanningDate[]>();

    return useQuery({
        queryKey: ['consulting-planning-dates', 'get-all'],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/planning-dates`
        })).data,
    });
};
