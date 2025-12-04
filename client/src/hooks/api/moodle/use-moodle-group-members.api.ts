import { useCallback } from 'react';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';
import { useAddUsersToMoodleMutation } from './use-add-users-to-moodle.mutation';

type PreviewItem = { localUserId: number; name: string; email: string; suggestedUsername: string; suggestedPassword: string };

export const useMoodleGroupMembersApi = () => {
  const request = useAuthenticatedAxios();
  const { mutateAsync: addUsersToMoodle } = useAddUsersToMoodleMutation();

  const previewUsersToCreate = useCallback(async (groupId: number, userIds: number[]) => {
    if (!groupId) return [] as PreviewItem[];
    const resp = await request({ method: 'POST', url: `${getApiHost()}/moodle/groups/${groupId}/add-members/preview`, data: { userIds } });
    return (resp?.data ?? []) as PreviewItem[];
  }, [request]);

  const addUsers = useCallback(async (groupId: number, userIds: number[]) => {
    return await addUsersToMoodle({ groupId, userIds });
  }, [addUsersToMoodle]);

  return { previewUsersToCreate, addUsers };
};

export default useMoodleGroupMembersApi;
