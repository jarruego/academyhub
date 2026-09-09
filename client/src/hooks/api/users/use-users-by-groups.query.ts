import { useQueries } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { User } from "../../../shared/types/user/user";

export type UserWithGroup = User & { id_group: number };

/**
 * Fusiona los alumnos de varios grupos en una sola lista, etiquetando cada fila con el
 * id_group de origen — necesario para "Enviar informe" (claves de selección id_user-id_group)
 * y para distinguir a un mismo alumno matriculado en más de uno de los grupos seleccionados.
 * Reutiliza la misma queryKey que useUsersByGroupQuery (['usersbygroup', id]) para compartir
 * caché con la vista de un único grupo, sin pedir un endpoint nuevo al servidor.
 */
export const useUsersByGroupsQuery = (groupIds: number[]) => {
  const request = useAuthenticatedAxios<User[]>();

  const results = useQueries({
    queries: groupIds.map((id_group) => ({
      queryKey: ['usersbygroup', id_group],
      queryFn: async () =>
        (await request({ method: 'GET', url: `${getApiHost()}/group/${id_group}/users` })).data,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const isFetching = results.some((r) => r.isFetching);
  const data: UserWithGroup[] = results.flatMap((r, idx) =>
    (r.data ?? []).map((u) => ({ ...u, id_group: groupIds[idx] }))
  );
  const refetch = () => Promise.all(results.map((r) => r.refetch()));

  return { data, isLoading, isFetching, refetch };
};

export default useUsersByGroupsQuery;
