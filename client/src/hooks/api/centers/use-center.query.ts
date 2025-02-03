import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { Center } from "../../../shared/types/center/center";

export const useCenterQuery = (id_center: string) => {
  const request = useAuthenticatedAxios<Center>();

  return useQuery<Center | undefined>({
    queryKey: ['center', id_center],
    queryFn: async () => {
      const { data } = await request({
        method: 'GET',
        url: `${getApiHost()}/center/${id_center}`,
      });
      return data;
    }
  });
}
