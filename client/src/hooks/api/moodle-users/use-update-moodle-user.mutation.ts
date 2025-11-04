import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { MoodleUserSelectModel } from "../../../shared/types/moodle/moodle-user.types";

type UpdateMoodleUserPayload = {
  id: number;
  moodle_username?: string | null;
  moodle_password?: string | null;
};

export const useUpdateMoodleUserMutation = (userId?: number) => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: UpdateMoodleUserPayload) => {
      const { id, ...data } = payload;
      const response = await request({
        method: 'PUT',
        url: `${getApiHost()}/moodle-user/${id}`,
        data,
      });
      return response.data;
    },
    onSuccess: () => {
      // invalidate moodle-users queries for the specific user if provided, else invalidate all
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['moodle-users', userId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['moodle-users'] });
      }
    }
  });

  /**
   * Helper: given an array of moodleUsers (for a local user) and new username/password values,
   * find the main moodle_user (is_main_user=true or first), compare values and call the mutation
   * only if values changed. Returns the mutation result or null if no update was needed.
   */
  const updateMainFor = async (
    moodleUsers?: (MoodleUserSelectModel)[],
    moodle_username?: string | null,
    moodle_password?: string | null
  ) => {
    if (!moodleUsers || moodleUsers.length === 0) return null;
    const main = moodleUsers.find(mu => mu.is_main_user) || moodleUsers[0];
    if (!main) return null;

    const changedUsername = (moodle_username ?? '') !== (main.moodle_username ?? '');
    const changedPassword = (moodle_password ?? '') !== (main.moodle_password ?? '');

    if (!changedUsername && !changedPassword) return null;

    // Call the mutation and return its result
    return await mutation.mutateAsync({ id: main.id_moodle_user, moodle_username, moodle_password });
  };

  return {
    ...mutation,
    updateMainFor,
  };
};
