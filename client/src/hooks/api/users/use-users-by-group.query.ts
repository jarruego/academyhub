import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { User } from "../../../shared/types/user/user";

export const useUsersByGroupQuery = (id_group: number | null) => {
  const request = useAuthenticatedAxios<User[]>();

  return useQuery({
    queryKey: ['usersbygroup', id_group],
    queryFn: async () => {
      if (id_group === null) return [];
      return (await request({
        method: 'GET',
        url: `${getApiHost()}/group/${id_group}/users`
      })).data;
    },
    enabled: id_group !== null,
  });
}
