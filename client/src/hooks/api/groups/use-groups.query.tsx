import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { Group } from "../../../shared/types/group/group";

export const useGroupsQuery = (id_course: string) => {
    const request = useAuthenticatedAxios<Group[]>();

    return useQuery({
        queryKey: ['groups', id_course],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/course/${id_course}/groups`
        })).data,
    });
}
