import { useQuery } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';

export interface AuditLogRow {
  id: number;
  actor_id: number | null;
  actor_username: string | null;
  actor_role: string | null;
  method: string | null;
  path: string | null;
  target: string | null;
  status_code: number | null;
  ip: string | null;
  created_at: string;
}

export interface AuditLogResponse {
  data: AuditLogRow[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditLogParams {
  page?: number;
  limit?: number;
  method?: string;
  actor?: string;
}

export const useAuditLogQuery = (params: AuditLogParams) => {
  const request = useAuthenticatedAxios<AuditLogResponse>();

  return useQuery({
    queryKey: ['audit-log', params],
    queryFn: async () => {
      // Solo enviamos filtros con valor para no ensuciar la query
      const cleaned: Record<string, string | number> = {};
      if (params.page) cleaned.page = params.page;
      if (params.limit) cleaned.limit = params.limit;
      if (params.method) cleaned.method = params.method;
      if (params.actor) cleaned.actor = params.actor;

      const res = await request({ method: 'GET', url: `${getApiHost()}/audit-log`, params: cleaned });
      return res.data;
    },
  });
};
