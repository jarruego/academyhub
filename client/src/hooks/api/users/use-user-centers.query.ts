import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { Center } from "../../../shared/types/center/center";

export const useUserCentersQuery = (id_user: number) => {
  const request = useAuthenticatedAxios<Center[]>();
  return useQuery({
    queryKey: ["user-centers", id_user],
    queryFn: async () => {
      const { data } = await request({
        method: "GET",
        url: `${getApiHost()}/user/${id_user}/centers`,
      });
      return data;
    },
    enabled: !!id_user,
  });
};
