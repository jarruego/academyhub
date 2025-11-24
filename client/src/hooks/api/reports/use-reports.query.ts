import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { PaginationResult } from "../../../shared/types/pagination";
import { ReportRow } from "../../../shared/types/reports/report-row";

export const useReportsQuery = (params?: Record<string, any>) => {
  const request = useAuthenticatedAxios<PaginationResult<ReportRow>>();

  return useQuery({
    queryKey: ['reports', params || {}],
    queryFn: async () => {
      const { data } = await request({
        method: 'GET',
        url: `${getApiHost()}/reports`,
        params,
      });
      return data;
    },
    staleTime: 1000 * 60 * 2, // cache 2 minutes
  });
};
