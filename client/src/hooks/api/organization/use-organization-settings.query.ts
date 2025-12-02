import { useQuery } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';
import type { OrganizationSettings } from '../../../shared/types/organization/organization';

export const useOrganizationSettingsQuery = () => {
  // Backend wraps the payload as { data: OrganizationSettings }
  const request = useAuthenticatedAxios<{ data: OrganizationSettings }>();

  return useQuery({
    queryKey: ['organization_settings'],
    // The backend wraps the payload as { data: <OrganizationSettings> }
    // so unwrap one level here and return the actual OrganizationSettings object
    queryFn: async () => {
      const res = await request({ method: 'GET', url: `${getApiHost()}/api/organization/settings` });
      return res.data.data ?? null;
    },
  });
};
