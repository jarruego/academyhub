import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { Center } from "../../../shared/types/center/center";

export const useCentersByCompaniesQuery = (companyIds?: number[] | null) => {
  const request = useAuthenticatedAxios<Center[]>();

  const key = ['centersByCompanies', (companyIds || []).join(',')];

  return useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!companyIds || companyIds.length === 0) return [] as Center[];

      const results = await Promise.all(companyIds.map(id => request({ method: 'GET', url: `${getApiHost()}/company/${id}/centers` }).then(r => r.data)));
      const merged: Center[] = results.flat();

      // dedupe by id_center (use typed access, avoid any casts)
      const map = new Map<number, Center>();
      for (const c of merged) {
        if (c && typeof c.id_center === 'number') map.set(c.id_center, c);
      }
      return Array.from(map.values());
    },
    // small cache to avoid repeated calls when user toggles companies quickly
    staleTime: 1000 * 60,
  });
};
