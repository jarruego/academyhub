import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { User } from "../../../shared/types/user/user";

export const useUserQuery = (id_user: number) => {
  const request = useAuthenticatedAxios<User>();

  return useQuery({
    queryKey: ['user', id_user],
    queryFn: async () => {
      const { data } = await request({
        method: 'GET',
        url: `${getApiHost()}/user/${id_user}`,
      });
      return data;
    }
  });
}
