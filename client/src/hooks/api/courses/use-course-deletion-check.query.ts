import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

/** Dependencias que retienen un curso (espejo de CourseDeletionCheck en el servidor). */
export interface CourseDeletionCheck {
    groups: number;
    enrollments: number;
    preinscriptions: number;
    canDelete: boolean;
    requiresEnrollmentDeletion: boolean;
}

/**
 * Query perezosa: no se lanza al montar. Se dispara con `refetch()` al pulsar
 * "Eliminar Curso", para decidir qué aviso mostrar.
 */
export const useCourseDeletionCheckQuery = (id_course: string) => {
    const request = useAuthenticatedAxios<CourseDeletionCheck>();

    return useQuery({
        queryKey: ['course-deletion-check', id_course],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/course/${id_course}/deletion-check`,
        })).data,
        enabled: false,
        gcTime: 0,
        staleTime: 0,
    });
}
