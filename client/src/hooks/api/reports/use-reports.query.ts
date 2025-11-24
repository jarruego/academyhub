import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { PaginationResult } from "../../../shared/types/pagination";
import { ReportRow } from "../../../shared/types/reports/report-row";

// Mirror of server-side ReportFilterDTO for typed client params
export type ReportsQueryParams = {
  page?: number;
  limit?: number;
  id_company?: number[];
  id_center?: number[];
  id_course?: number;
  id_group?: number[];
  id_role?: number;
  search?: string;
  start_date?: string;
  end_date?: string;
  sort_field?: string;
  sort_order?: 'asc' | 'desc';
};

export const useReportsQuery = (params?: ReportsQueryParams) => {
  const request = useAuthenticatedAxios<PaginationResult<ReportRow>>();

  return useQuery({
    queryKey: ['reports', params || {}],
    queryFn: async () => {
      try {
        const { data } = await request({
          method: 'GET',
          url: `${getApiHost()}/reports`,
          params,
        });
        return data;
      } catch (err: any) {
        // Log server validation message (if any) to help debugging in the browser console
        if (err?.response?.data) {
          // eslint-disable-next-line no-console
          console.error('Reports API error response:', err.response.data);
        }
        throw err;
      }
    },
    staleTime: 1000 * 60 * 2, // cache 2 minutes
  });
};
