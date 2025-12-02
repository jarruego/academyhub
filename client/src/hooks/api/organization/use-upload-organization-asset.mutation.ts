import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';
import type { OrganizationSettings } from '../../../shared/types/organization/organization';

export const useUploadOrganizationAsset = () => {
  // Response is the updated OrganizationSettings row wrapped as { data: OrganizationSettings }
  // Request body is FormData
  const request = useAuthenticatedAxios<{ data: OrganizationSettings }, FormData>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { file: Blob; type: 'logo' | 'signature' }) => {
      const fd = new FormData();
      fd.append('file', payload.file);
      fd.append('type', payload.type);
      const res = await request({ method: 'POST', url: `${getApiHost()}/api/organization/upload`, data: fd });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization_settings'] });
    },
  });
};
