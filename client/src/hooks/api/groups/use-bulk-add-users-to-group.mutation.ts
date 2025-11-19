import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

type Req = { userIds: number[] };

export const useBulkAddUsersToGroupMutation = () => {
  const request = useAuthenticatedAxios<Req | { addedIds: number[]; existingIds: number[]; failedIds: number[] }>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id_group, userIds }: { id_group: number; userIds: number[] }) => {
      const resp = await request({ method: 'POST', url: `${getApiHost()}/group/${id_group}/users/bulk-add`, data: { userIds } });
      return resp.data;
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['usersbygroup'] });
    }
  });
};
