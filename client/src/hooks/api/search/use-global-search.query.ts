import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export interface GlobalSearchUser {
  id_user: number;
  name: string;
  first_surname: string | null;
  second_surname: string | null;
  dni: string | null;
}

export interface GlobalSearchCourse {
  id_course: number;
  catalog_course_name: string;
  catalog_course_short_name: string;
  file_number: string | null;
}

export interface GlobalSearchCompany {
  id_company: number;
  company_name: string;
  cif: string;
}

export interface GlobalSearchCenter {
  id_center: number;
  center_name: string;
}

export interface GlobalSearchResult {
  users: GlobalSearchUser[];
  courses: GlobalSearchCourse[];
  companies: GlobalSearchCompany[];
  centers: GlobalSearchCenter[];
}

/** Buscador global del dashboard Home. `term` debe venir ya con debounce aplicado. */
export const useGlobalSearchQuery = (term: string) => {
  const request = useAuthenticatedAxios<GlobalSearchResult>();
  const trimmed = term.trim();
  return useQuery({
    queryKey: ["global-search", trimmed] as const,
    queryFn: async () =>
      (await request({ method: "GET", url: `${getApiHost()}/api/search`, params: { q: trimmed } })).data,
    enabled: trimmed.length >= 2,
    // Mantiene el resultado anterior mientras llega el nuevo (evita el parpadeo del desplegable al teclear).
    placeholderData: (previous) => previous,
  });
};
