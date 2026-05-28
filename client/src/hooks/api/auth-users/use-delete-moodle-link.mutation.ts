import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useDeleteMoodleLink = (authUserId: number | undefined) => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (linkId: number) => {
      await request({
        method: "DELETE",
        url: `${getApiHost()}/auth/users/moodle-links/${linkId}`,
      });
      return linkId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moodle-links", authUserId] });
    },
  });
};
