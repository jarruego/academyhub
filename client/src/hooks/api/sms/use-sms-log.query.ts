import { useQuery } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';

export type MailrelaySmsStatus = 'not_processed' | 'processed' | 'ignored' | 'delivered' | 'failed' | 'expired';

export interface SmsLogRow {
  id: number;
  actor_id: number | null;
  actor_username: string | null;
  actor_role: string | null;
  recipient: string | null;
  template_id: number | null;
  template_name: string | null;
  sender_name: string | null;
  mailrelay_id: number | null;
  status: 'sent' | 'failed';
  error_message: string | null;
  mailrelay_status: MailrelaySmsStatus | null;
  mailrelay_status_checked_at: string | null;
  parts_count: number | null;
  used_credits: string | null;
  created_at: string;
}

export interface SmsLogResponse {
  data: SmsLogRow[];
  total: number;
  page: number;
  limit: number;
}

export interface SmsLogParams {
  page?: number;
  limit?: number;
  status?: string;
  actor?: string;
  recipient?: string;
}

export const useSmsLogQuery = (params: SmsLogParams) => {
  const request = useAuthenticatedAxios<SmsLogResponse>();

  return useQuery({
    queryKey: ['sms-log', params],
    queryFn: async () => {
      const cleaned: Record<string, string | number> = {};
      if (params.page) cleaned.page = params.page;
      if (params.limit) cleaned.limit = params.limit;
      if (params.status) cleaned.status = params.status;
      if (params.actor) cleaned.actor = params.actor;
      if (params.recipient) cleaned.recipient = params.recipient;

      const res = await request({ method: 'GET', url: `${getApiHost()}/sms-log`, params: cleaned });
      return res.data;
    },
  });
};
