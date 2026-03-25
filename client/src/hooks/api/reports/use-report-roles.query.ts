import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export type ReportRoleOption = {
  id_role: number;
  role_shortname: string;
};

export const useReportRolesQuery = () => {
  const request = useAuthenticatedAxios<ReportRoleOption[]>();

  return useQuery({
    queryKey: ["report-roles"],
    queryFn: async () => {
      const { data } = await request({
        method: "GET",
        url: `${getApiHost()}/reports/roles`,
      });
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
};
