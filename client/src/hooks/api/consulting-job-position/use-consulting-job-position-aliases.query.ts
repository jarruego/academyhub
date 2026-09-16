import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingJobPositionAlias } from "../../../shared/types/consulting-job-position/consulting-job-position";

export const useConsultingJobPositionAliasesQuery = () => {
    const request = useAuthenticatedAxios<ConsultingJobPositionAlias[]>();

    return useQuery({
        queryKey: ['consulting-job-position-aliases', 'get-all'],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/job-position-aliases`
        })).data,
    });
};
