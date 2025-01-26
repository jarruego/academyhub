import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { User } from "../../../shared/types/user/user";

export const useUsersQuery = () => {
    const request = useAuthenticatedAxios<User[]>();

    return useQuery({
        queryKey: ['users', 'get-all'],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/user`
        })).data,
    });
}