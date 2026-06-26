import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ReportFacets } from "../../../shared/types/reports/report-facets";
import { ReportsQueryParams } from "./use-reports.query";

// Filtros que influyen en las facetas. Se omiten paginación y ordenación porque no
// afectan al conjunto filtrado y solo provocarían recálculos innecesarios.
export type ReportFacetsParams = Omit<ReportsQueryParams, 'page' | 'limit' | 'sort_field' | 'sort_order'>;

export const useReportFacetsQuery = (params?: ReportFacetsParams) => {
  const request = useAuthenticatedAxios<ReportFacets>();

  return useQuery({
    queryKey: ['report-facets', params || {}],
    queryFn: async () => {
      const { data } = await request({
        method: 'GET',
        url: `${getApiHost()}/reports/facets`,
        params,
      });
      return data;
    },
    // Conserva las opciones anteriores mientras recalcula para evitar parpadeos a vacío.
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
};
