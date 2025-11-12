import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { User } from "../../../shared/types/user/user";
import { getApiHost } from "../../../utils/api/get-api-host.util";

// Use a Partial<User> but explicitly exclude `id_user` so the id is never sent in the body
type UpdateData = Omit<Partial<User>, 'id_user'>;

export const useBulkUpdateUsersMutation = () => {
  const request = useAuthenticatedAxios<UpdateData>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { id_user: number; data: UpdateData }[]) => {
      // Execute PUT requests in parallel
      const tasks = updates.map(u => request({ method: 'PUT', url: `${getApiHost()}/user/${u.id_user}`, data: u.data }));
      return Promise.all(tasks);
    },
    onSuccess: () => {
      // Invalidate lookups and lists
      queryClient.invalidateQueries({ queryKey: ['users', 'lookup'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'get-all'] });
    },
  });
};
