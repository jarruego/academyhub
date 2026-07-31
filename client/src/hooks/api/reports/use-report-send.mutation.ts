import { useMutation } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import type { ReportsQueryParams } from "./use-reports.query";

// 'dedication_passwords' es un adjunto aparte (no un modificador de
// 'dedication'): un PDF de Dedicación adicional que incluye usuario/clave
// Moodle, para poder enviar ambos a la vez o solo el que corresponda.
export type ReportAttachmentType = 'dedication' | 'dedication_passwords' | 'certification';

export interface ReportSendRecipient {
  /** group_key devuelto por useReportSendGroupsMutation ("req:<id_request>" | "ctr:<id_center>"). */
  group_key: string;
  emails: string[];
}

export interface ReportSendRequest {
  filter?: ReportsQueryParams;
  selected_keys?: string[];
  select_all_matching?: boolean;
  deselected_keys?: string[];
  attach: ReportAttachmentType[];
  recipients?: ReportSendRecipient[];
  send_mode: 'template' | 'custom';
  template_id?: number;
  subject?: string;
  html?: string;
  text?: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
  test_email?: string;
}

export interface ReportSendResult {
  group_key: string;
  kind: 'request' | 'center' | 'unassignable';
  center_name: string;
  course_name?: string | null;
  status: 'sent' | 'skipped' | 'failed';
  recipients?: string[];
  note?: string;
  error?: string;
}

export const useReportSendMutation = () => {
  const request = useAuthenticatedAxios<{ results: ReportSendResult[] }>();

  return useMutation({
    mutationFn: async (data: ReportSendRequest) => {
      const resp = await request({ method: 'POST', url: `${getApiHost()}/reports/send`, data });
      return resp.data.results;
    },
  });
};

export const useReportSendTestMutation = () => {
  const request = useAuthenticatedAxios<{ center_name: string }>();

  return useMutation({
    mutationFn: async (data: ReportSendRequest) => {
      const resp = await request({ method: 'POST', url: `${getApiHost()}/reports/send/test`, data });
      return resp.data;
    },
  });
};
