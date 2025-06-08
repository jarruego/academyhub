import { useMutation } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export interface UpdateUserMainCenterPayload {
  userId: number;
  centerId: number;
}

export const useUpdateUserMainCenterMutation = () => {
  const request = useAuthenticatedAxios();
  return useMutation({
    mutationFn: async (payload: UpdateUserMainCenterPayload) => {
      await request({
        method: "PUT",
        url: `${getApiHost()}/center/users-main-center`,
        data: { users: [payload] },
      });
    },
  });
};
