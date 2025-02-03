import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { Group } from "../../../shared/types/group/group";

export const useGroupQuery = (id_group: string) => {
  const request = useAuthenticatedAxios<Group>();

  return useQuery<Group | undefined>({
    queryKey: ['group', id_group],
    queryFn: async () => {
      const { data } = await request({
        method: 'GET',
        url: `${getApiHost()}/group/${id_group}`,
      });
      return data;
    }
  });
}