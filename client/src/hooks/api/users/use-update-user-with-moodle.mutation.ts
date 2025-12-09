import { useUpdateUserMutation } from "./use-update-user.mutation";
import { useUpdateMoodleUserMutation } from "../moodle-users/use-update-moodle-user.mutation";
import { MoodleUserSelectModel } from "../../../shared/types/moodle/moodle-user.types";

type Payload = {
  userInfo: any;
  moodleUsername: string | null | undefined;
  moodlePassword: string | null | undefined;
  moodleUsers?: MoodleUserSelectModel[];
};

export function useUpdateUserWithMoodleMutation(userId: number) {
  const { mutateAsync: updateUser } = useUpdateUserMutation(userId);
  const { updateMainFor } = useUpdateMoodleUserMutation(userId);

  async function mutateAsync(payload: Payload) {
    // First update the local user and obtain the updated user
    const updated = await updateUser(payload.userInfo);

    // Then attempt to update Moodle main user if applicable
    try {
      // normalize undefined -> null for the helper
      await updateMainFor(payload.moodleUsers, payload.moodleUsername ?? null, payload.moodlePassword ?? null);
    } catch (err: any) {
      const e: any = new Error('Failed to update Moodle account');
      e.type = 'moodle';
      e.original = err;
      throw e;
    }

    return updated;
  }

  return { mutateAsync };
}
