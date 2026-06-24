import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { Center } from "../../../shared/types/center/center";

export const useCentersQuery = (id_company?: string) => {
    const request = useAuthenticatedAxios<Center[]>();

    return useQuery({
        queryKey: id_company ? ['centers', id_company] : ['centers', 'all'],
        queryFn: async () => (await request({
            method: 'GET',
            url: id_company ? `${getApiHost()}/center?id_company=${id_company}` : `${getApiHost()}/center`
        })).data,
    });
};
