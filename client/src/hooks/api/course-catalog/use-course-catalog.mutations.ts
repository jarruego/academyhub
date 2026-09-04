import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CatalogCourse, CatalogCourseInput } from "../../../shared/types/course-catalog/course-catalog";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";

export function useCreateCatalogCourseMutation() {
  const request = useAuthenticatedAxios<CatalogCourse>();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (data: CatalogCourseInput) => (await request({ method: "POST", url: `${getApiHost()}/course-catalog`, data })).data,
    onSuccess: () => client.invalidateQueries({ queryKey: ["course-catalog"] }),
  });
}

export function useUpdateCatalogCourseMutation(id: number) {
  const request = useAuthenticatedAxios<CatalogCourse>();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<CatalogCourseInput>) => (await request({ method: "PUT", url: `${getApiHost()}/course-catalog/${id}`, data })).data,
    onSuccess: () => client.invalidateQueries({ queryKey: ["course-catalog"] }),
  });
}

export function useMergeCatalogCourseMutation(id: number) {
  const request = useAuthenticatedAxios<CatalogCourse>();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (target_id: number) => (await request({ method: "POST", url: `${getApiHost()}/course-catalog/${id}/merge`, data: { target_id } })).data,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["course-catalog"] });
      client.invalidateQueries({ queryKey: ["courses"] });
    },
  });
}
