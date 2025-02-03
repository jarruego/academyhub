
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { Group } from "../../../shared/types/group/group";

export const useCreateGroupMutation = () => {
  const request = useAuthenticatedAxios<Omit<Group, 'id_group'>>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newGroup: Omit<Group, 'id_group'>) => {
      await request({
        method: 'POST',
        url: `${getApiHost()}/group`,
        data: newGroup,
      });
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['groups', 'get-all'] });
    },
  });
};