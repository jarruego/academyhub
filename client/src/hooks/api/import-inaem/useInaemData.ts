import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export interface UserPreinscription {
  id_course: number;
  status: "PREINSCRITO" | "MATRICULADO" | "DESCARTADO" | "BAJA";
  prioritaria: boolean;
  preinscription_date: string | null;
  course_name: string;
  file_number: string | null;
  client: string | null;
  // Finalización de la matrícula: true/false si está matriculado, null si no hay datos.
  finalized: boolean | null;
}

export interface CoursePreinscription {
  id_user: number;
  id_course: number;
  status: "PREINSCRITO" | "MATRICULADO" | "DESCARTADO" | "BAJA";
  prioritaria: boolean;
  preinscription_date: string | null;
  name: string | null;
  first_surname: string | null;
  second_surname: string | null;
  dni: string | null;
  email: string | null;
}

export interface InaemConflict {
  id: number;
  import_source: string;
  dni_csv: string | null;
  name_csv: string | null;
  first_surname_csv: string | null;
  second_surname_csv: string | null;
  name_db: string | null;
  first_surname_db: string | null;
  second_surname_db: string | null;
  dni_db: string | null;
  email_db: string | null;
  selected_user_id: number | null;
  change_metadata: {
    id_user?: number;
    conflicts?: { field: string; dbValue: string; incomingValue: string }[];
  } | null;
}

export const useUserPreinscriptionsQuery = (userId: number, enabled = true) => {
  const request = useAuthenticatedAxios();
  return useQuery({
    queryKey: ["inaem-preinscriptions", "user", userId],
    queryFn: async (): Promise<UserPreinscription[]> => {
      const res = await request({
        method: "GET",
        url: `${getApiHost()}/api/import-inaem/preinscriptions/by-user/${userId}`,
      });
      return res.data as UserPreinscription[];
    },
    enabled: !!userId && enabled,
  });
};

export const useCoursePreinscriptionsQuery = (courseId: number, enabled = true) => {
  const request = useAuthenticatedAxios();
  return useQuery({
    queryKey: ["inaem-preinscriptions", "course", courseId],
    queryFn: async (): Promise<CoursePreinscription[]> => {
      const res = await request({
        method: "GET",
        url: `${getApiHost()}/api/import-inaem/preinscriptions/by-course/${courseId}`,
      });
      return res.data as CoursePreinscription[];
    },
    enabled: !!courseId && enabled,
  });
};

export const useCourseEnrolledCountQuery = (courseId: number, enabled = true) => {
  const request = useAuthenticatedAxios();
  return useQuery({
    queryKey: ["inaem-enrolled-count", "course", courseId],
    queryFn: async (): Promise<number> => {
      const res = await request({
        method: "GET",
        url: `${getApiHost()}/api/import-inaem/preinscriptions/by-course/${courseId}/enrolled-count`,
      });
      return (res.data as { count: number }).count;
    },
    enabled: !!courseId && enabled,
  });
};

export const useDeleteCoursePreinscriptionsMutation = (courseId: number) => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ deleted: number }> => {
      const res = await request({
        method: "DELETE",
        url: `${getApiHost()}/api/import-inaem/preinscriptions/by-course/${courseId}`,
      });
      return res.data as { deleted: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inaem-preinscriptions"] });
    },
  });
};

export const useInaemConflictsQuery = () => {
  const request = useAuthenticatedAxios();
  return useQuery({
    queryKey: ["inaem-conflicts"],
    queryFn: async (): Promise<InaemConflict[]> => {
      const res = await request({ method: "GET", url: `${getApiHost()}/api/import-inaem/conflicts` });
      return res.data as InaemConflict[];
    },
  });
};

export const useResolveInaemConflictMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "overwrite" | "keep" }) => {
      await request({
        method: "PUT",
        url: `${getApiHost()}/api/import-inaem/conflicts/${id}/resolve`,
        data: { action },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inaem-conflicts"] });
    },
  });
};

export const useDeleteInaemConflictMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await request({
        method: "DELETE",
        url: `${getApiHost()}/api/import-inaem/conflicts/${id}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inaem-conflicts"] });
    },
  });
};

export const useDeleteAllInaemConflictsMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ deleted: number }> => {
      const res = await request({
        method: "DELETE",
        url: `${getApiHost()}/api/import-inaem/conflicts`,
      });
      return res.data as { deleted: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inaem-conflicts"] });
    },
  });
};
