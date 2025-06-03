import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useDeleteUsersFromCentersMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: { id_center: number; id_user: number }[]) => {
      if (items.length === 1) {
        const { id_center, id_user } = items[0];
        return await request({
          method: "DELETE",
          url: `${getApiHost()}/center/${id_center}/users/${id_user}`,
        });
      } else {
        throw new Error("El borrado múltiple no está implementado en este endpoint");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-centers"] });
    },
  });
};
