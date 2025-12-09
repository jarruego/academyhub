import { useCallback } from 'react';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';

type PreviewItem = { localUserId: number; name: string; email: string; suggestedUsername: string; suggestedPassword: string };

export const usePreviewAddUserToMoodle = () => {
  const request = useAuthenticatedAxios();

  const preview = useCallback(async (userId: number) => {
    const resp = await request({ method: 'POST', url: `${getApiHost()}/moodle/users/${userId}/preview-add-to-moodle`, data: {} });
    return (resp?.data ?? []) as PreviewItem[];
  }, [request]);

  return { preview };
};

export default usePreviewAddUserToMoodle;
