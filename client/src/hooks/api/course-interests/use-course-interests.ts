import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import type { CourseInterest, CourseInterestPatch, CreateCourseInterestInput, InterestStatus } from "../../../shared/types/course-interest/course-interest";

const catalogKey = (idCatalogCourse: number) => ["course-interests", "catalog", idCatalogCourse] as const;
const listKey = (filters?: CourseInterestFilters) => ["course-interests", "list", filters ?? {}] as const;

export interface CourseInterestFilters {
  id_catalog_course?: number;
  status?: InterestStatus;
  assigned_to?: number;
}

export const useCourseInterestsByCatalogQuery = (idCatalogCourse: number, enabled = true) => {
  const request = useAuthenticatedAxios<CourseInterest[]>();
  return useQuery({
    queryKey: catalogKey(idCatalogCourse),
    queryFn: async () => (await request({ method: "GET", url: `${getApiHost()}/course-interests`, params: { id_catalog_course: idCatalogCourse } })).data,
    enabled: enabled && idCatalogCourse > 0,
  });
};

export const useCourseInterestsQuery = (filters: CourseInterestFilters = {}) => {
  const request = useAuthenticatedAxios<CourseInterest[]>();
  return useQuery({
    queryKey: listKey(filters),
    queryFn: async () => (await request({ method: "GET", url: `${getApiHost()}/course-interests`, params: filters })).data,
  });
};

const invalidateAll = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({ queryKey: ["course-interests"] });

export const useCreateCourseInterestMutation = () => {
  const request = useAuthenticatedAxios<CourseInterest>();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateCourseInterestInput) => (await request({ method: "POST", url: `${getApiHost()}/course-interests`, data })).data,
    onSuccess: () => invalidateAll(queryClient),
  });
};

/** Optimista: aplica cada patch al listado en caché al instante, sin esperar la respuesta ni recargar todo (evita el "salto" perceptible al editar una celda). */
export const useUpdateCourseInterestsMutation = (catalogCourseId: number) => {
  const request = useAuthenticatedAxios<CourseInterest[]>();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (interests: CourseInterestPatch[]) =>
      (await request({ method: "PUT", url: `${getApiHost()}/course-interests/bulk`, data: { interests } })).data,
    onMutate: async (interests: CourseInterestPatch[]) => {
      await queryClient.cancelQueries({ queryKey: catalogKey(catalogCourseId) });
      const previous = queryClient.getQueryData<CourseInterest[]>(catalogKey(catalogCourseId));
      if (previous) {
        const patchById = new Map(interests.map(i => [i.id_interest, i]));
        queryClient.setQueryData<CourseInterest[]>(catalogKey(catalogCourseId), previous.map(row =>
          patchById.has(row.id_interest) ? { ...row, ...patchById.get(row.id_interest) } : row,
        ));
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(catalogKey(catalogCourseId), context.previous);
    },
    onSettled: () => invalidateAll(queryClient),
  });
};

export const useDeleteCourseInterestMutation = () => {
  const request = useAuthenticatedAxios<CourseInterest>();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (idInterest: number) => (await request({ method: "DELETE", url: `${getApiHost()}/course-interests/${idInterest}` })).data,
    onSuccess: () => invalidateAll(queryClient),
  });
};

export const useIncorporateInterestsMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id_course: number; interest_ids: number[] }) =>
      (await request({ method: "POST", url: `${getApiHost()}/course-interests/incorporate`, data })).data,
    onSuccess: () => {
      invalidateAll(queryClient);
      queryClient.invalidateQueries({ queryKey: ["course-candidates"] });
    },
  });
};
