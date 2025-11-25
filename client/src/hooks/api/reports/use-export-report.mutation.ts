import { useMutation } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export type ReportExportRequest = {
  filter?: any;
  report_type?: string;
  include_passwords?: boolean;
  format?: 'pdf' | 'csv';
  report_options?: Record<string, unknown>;
};

export const useExportReportMutation = () => {
  const request = useAuthenticatedAxios();

  return useMutation({
    mutationFn: async (data: ReportExportRequest) => {
      const response = await request({
        method: 'POST',
        url: `${getApiHost()}/reports/export`,
        data,
        responseType: 'blob',
      });
      return response; // full axios response (blob)
    }
  });
};
