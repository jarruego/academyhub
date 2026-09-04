import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import type { CourseCandidate, CourseCandidatePatch } from "../../../shared/types/course-candidate/course-candidate";

const key = (courseId: number) => ["course-candidates", courseId] as const;

export const useCourseCandidatesQuery = (courseId: number, enabled = true) => {
  const request = useAuthenticatedAxios<CourseCandidate[]>();
  return useQuery({
    queryKey: key(courseId),
    queryFn: async () => (await request({ method: "GET", url: `${getApiHost()}/course-candidates?id_course=${courseId}` })).data,
    enabled: enabled && courseId > 0,
  });
};

type CreateCandidateInput =
  | { id_user: number; source?: "MANUAL" | "EXCEL_OPERATIVO"; new_user?: undefined }
  | { id_user?: undefined; source?: "MANUAL"; new_user: { name: string; first_surname?: string; second_surname?: string; dni?: string; phone?: string; email?: string } };

export const useCreateCourseCandidateMutation = (courseId: number) => {
  const request = useAuthenticatedAxios<CourseCandidate>();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id_user, source = "MANUAL", new_user }: CreateCandidateInput) =>
      (await request({ method: "POST", url: `${getApiHost()}/course-candidates`, data: { id_user, id_course: courseId, source, new_user } })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(courseId) }),
  });
};

type UpdateCandidateUserInput = { id_user: number; patch: { name: string; dni?: string | null; phone?: string | null; email?: string | null } };

/** Edita dni/teléfono/email del usuario tras una candidatura (autoguardado "como excel"). Optimista: refleja el cambio al instante, sin esperar al servidor ni recargar todo el listado. */
export const useUpdateCandidateUserMutation = (courseId: number) => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id_user, patch }: UpdateCandidateUserInput) =>
      (await request({ method: "PUT", url: `${getApiHost()}/user/${id_user}`, data: patch })).data,
    onMutate: async ({ id_user, patch }: UpdateCandidateUserInput) => {
      await queryClient.cancelQueries({ queryKey: key(courseId) });
      const previous = queryClient.getQueryData<CourseCandidate[]>(key(courseId));
      if (previous) {
        queryClient.setQueryData<CourseCandidate[]>(key(courseId), previous.map(row => {
          if (row.id_user !== id_user) return row;
          const next = { ...row, name: patch.name };
          if (patch.dni !== undefined) next.dni = patch.dni;
          if (patch.phone !== undefined) next.phone = patch.phone;
          if (patch.email !== undefined) next.email = patch.email;
          return next;
        }));
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key(courseId), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key(courseId) }),
  });
};

/** Optimista: aplica cada patch al listado en caché al instante, sin esperar la respuesta ni recargar todo (evita el "salto" perceptible al editar una celda). */
export const useUpdateCourseCandidatesMutation = (courseId: number) => {
  const request = useAuthenticatedAxios<CourseCandidate[]>();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (candidates: CourseCandidatePatch[]) =>
      (await request({ method: "PUT", url: `${getApiHost()}/course-candidates/bulk`, data: { candidates } })).data,
    onMutate: async (candidates: CourseCandidatePatch[]) => {
      await queryClient.cancelQueries({ queryKey: key(courseId) });
      const previous = queryClient.getQueryData<CourseCandidate[]>(key(courseId));
      if (previous) {
        const patchById = new Map(candidates.map(c => [c.id_candidate, c]));
        queryClient.setQueryData<CourseCandidate[]>(key(courseId), previous.map(row =>
          patchById.has(row.id_candidate) ? { ...row, ...patchById.get(row.id_candidate) } : row,
        ));
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key(courseId), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key(courseId) }),
  });
};

export const useDeleteCourseCandidateMutation = (courseId: number) => {
  const request = useAuthenticatedAxios<CourseCandidate>();
  const queryClient = useQueryClient();
  return useMutation({
    // `force`: borra igualmente aunque la persona conste preinscrita en INAEM
    // (el servidor nunca toca `user_preinscription`, solo omite el bloqueo).
    mutationFn: async ({ candidateId, force }: { candidateId: number; force?: boolean }) =>
      (await request({ method: "DELETE", url: `${getApiHost()}/course-candidates/${candidateId}`, params: force ? { force: true } : undefined })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(courseId) }),
  });
};
