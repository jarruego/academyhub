import { useMutation } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export interface UpdateUserEnrollmentCenterPayload {
  groupId: number;
  userId: number;
  centerId: number;
}

export const useUpdateUserEnrollmentCenterMutation = () => {
  const request = useAuthenticatedAxios();
  return useMutation({
    mutationFn: async (payload: UpdateUserEnrollmentCenterPayload) => {
      await request({
        method: "PUT",
        url: `${getApiHost()}/group/${payload.groupId}/users/${payload.userId}`,
        data: { id_center: payload.centerId },
      });
    },
  });
};
