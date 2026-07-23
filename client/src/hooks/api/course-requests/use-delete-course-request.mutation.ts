import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useDeleteCourseRequestMutation = (id_request: number) => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await request({
        method: "DELETE",
        url: `${getApiHost()}/api/course-requests/${id_request}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-requests"] });
    },
  });
};
