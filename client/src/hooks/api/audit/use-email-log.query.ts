import { useQuery } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';

export interface EmailLogRow {
  id: number;
  actor_id: number | null;
  actor_username: string | null;
  actor_role: string | null;
  recipient: string | null;
  subject: string | null;
  template_id: number | null;
  template_name: string | null;
  sender_mode: string | null;
  from_name: string | null;
  from_email: string | null;
  via_moodle: boolean | null;
  status: string;
  error_message: string | null;
  notes: string | null;
  created_at: string;
}

export interface EmailLogResponse {
  data: EmailLogRow[];
  total: number;
  page: number;
  limit: number;
}

export interface EmailLogParams {
  page?: number;
  limit?: number;
  status?: string;
  actor?: string;
  recipient?: string;
}

export const useEmailLogQuery = (params: EmailLogParams) => {
  const request = useAuthenticatedAxios<EmailLogResponse>();

  return useQuery({
    queryKey: ['email-log', params],
    queryFn: async () => {
      const cleaned: Record<string, string | number> = {};
      if (params.page) cleaned.page = params.page;
      if (params.limit) cleaned.limit = params.limit;
      if (params.status) cleaned.status = params.status;
      if (params.actor) cleaned.actor = params.actor;
      if (params.recipient) cleaned.recipient = params.recipient;

      const res = await request({ method: 'GET', url: `${getApiHost()}/email-log`, params: cleaned });
      return res.data;
    },
  });
};
