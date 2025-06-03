import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export interface AddUserToCenterPayload {
  id_center: number;
  id_user: number;
  start_date?: Date | string;
  end_date?: Date | string;
}

export const useAddUserToCenterMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AddUserToCenterPayload) => {
      await request({
        method: "POST",
        url: `${getApiHost()}/center/${payload.id_center}/users`,
        data: {
          id_user: payload.id_user,
          start_date: payload.start_date,
          end_date: payload.end_date,
        },
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user-centers", variables.id_user] });
    },
  });
};
