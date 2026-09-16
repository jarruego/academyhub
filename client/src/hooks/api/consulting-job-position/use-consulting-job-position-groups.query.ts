import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingJobPositionGroup } from "../../../shared/types/consulting-job-position/consulting-job-position";

export const useConsultingJobPositionGroupsQuery = () => {
    const request = useAuthenticatedAxios<ConsultingJobPositionGroup[]>();

    return useQuery({
        queryKey: ['consulting-job-position-groups', 'get-all'],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/job-position-groups`
        })).data,
    });
};
