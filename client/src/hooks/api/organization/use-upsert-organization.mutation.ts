import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';
import type { OrganizationSettings, OrganizationUpsertPayload } from '../../../shared/types/organization/organization';

export const useUpsertOrganizationMutation = () => {
  // The backend response body has the shape: { data: OrganizationSettings }
  // Tell axios that so we can access res.data.data with proper typing.
  const request = useAuthenticatedAxios<{ data: OrganizationSettings }, OrganizationUpsertPayload>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: OrganizationUpsertPayload) => {
      const res = await request({ method: 'PATCH', url: `${getApiHost()}/api/organization/settings`, data: payload });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization_settings'] });
    },
  });
};
