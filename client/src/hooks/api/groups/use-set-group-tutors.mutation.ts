import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useSetGroupTutorsMutation = (id_group: string) => {
  const request = useAuthenticatedAxios<{ id_group: number; tutorUserIds: number[] }>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userIds: number[]) => {
      const response = await request({
        method: 'PUT',
        url: `${getApiHost()}/group/${id_group}/tutors`,
        data: { userIds },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['usersbygroup', Number(id_group)] });
    },
  });
};
