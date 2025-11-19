import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { User } from "../../../shared/types/user/user";
import { getApiHost } from "../../../utils/api/get-api-host.util";

// Use a Partial<User> but explicitly exclude `id_user` so the id is never sent in the body
type UpdateData = Omit<Partial<User>, 'id_user'>;

type BulkUpdateRequest = { id_user: number; data: UpdateData }[];
type BulkUpdateResponse = { updatedIds: number[]; failedIds: number[] };

export const useBulkUpdateUsersMutation = () => {
  // The axios helper takes a single generic used for the request/response shape.
  // Use a union so the config accepts the request body type and the response is typed as the response shape.
  const request = useAuthenticatedAxios<BulkUpdateRequest | BulkUpdateResponse>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { id_user: number; data: UpdateData }[]) => {
      // Use server-side bulk endpoint to update many users in one request.
      const resp = await request({ method: 'POST', url: `${getApiHost()}/user/bulk-update`, data: updates });
      return resp.data;
    },
    onSuccess: () => {
      // Invalidate lookups and lists
      queryClient.invalidateQueries({ queryKey: ['users', 'lookup'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'get-all'] });
    },
  });
};
