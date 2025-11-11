import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { Group } from "../../../shared/types/group/group";

// Accept nullable id_group and avoid performing the request when no id is provided.
export const useGroupQuery = (id_group?: string | null) => {
  const request = useAuthenticatedAxios<Group>();

  return useQuery<Group | undefined>({
    queryKey: ['group', id_group ?? null],
    // Don't run the query when no id_group is provided
    enabled: !!id_group,
    queryFn: async () => {
      const { data } = await request({
        method: 'GET',
        url: `${getApiHost()}/group/${id_group}`,
      });
      return data;
    }
  });
}