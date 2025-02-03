
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { Group } from "../../../shared/types/group/group";

export const useUpdateGroupMutation = (id_group: string) => {
  const request = useAuthenticatedAxios<Group>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updatedGroup: Group) => {
      await request({
        method: 'PUT',
        url: `${getApiHost()}/group/${id_group}`,
        data: updatedGroup,
      });
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['group', id_group] });
    },
  });
};