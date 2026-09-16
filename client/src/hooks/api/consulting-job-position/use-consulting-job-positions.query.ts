import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingJobPosition } from "../../../shared/types/consulting-job-position/consulting-job-position";

export const useConsultingJobPositionsQuery = () => {
    const request = useAuthenticatedAxios<ConsultingJobPosition[]>();

    return useQuery({
        queryKey: ['consulting-job-positions', 'get-all'],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/job-positions`
        })).data,
    });
};
