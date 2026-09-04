import { useQuery } from "@tanstack/react-query";
import { CatalogCourse } from "../../../shared/types/course-catalog/course-catalog";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";

export function useCourseCatalogQuery(search?: string) {
  const request = useAuthenticatedAxios<CatalogCourse[]>();
  return useQuery({
    queryKey: ["course-catalog", search ?? ""],
    queryFn: async () => (await request({ method: "GET", url: `${getApiHost()}/course-catalog`, params: search ? { search } : undefined })).data,
  });
}

export function useCatalogCourseQuery(id?: string | number) {
  const request = useAuthenticatedAxios<CatalogCourse>();
  return useQuery({
    queryKey: ["course-catalog", "detail", id],
    enabled: Boolean(id),
    queryFn: async () => (await request({ method: "GET", url: `${getApiHost()}/course-catalog/${id}` })).data,
  });
}
