import { useMutation } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

interface BonificationFileRequest {
  groupId: number;
  userIds: number[];
}
export const useCreateBonificationFileMutation = () => {
  const request = useAuthenticatedAxios();
  
  return useMutation({
    mutationFn: async (data: BonificationFileRequest) => {
      const response = await request({
        method: "POST",
        url: `${getApiHost()}/group/bonification-file`,
        data,
        responseType: "blob",
        headers: { Accept: "application/xml" },
      });
      return response; // return full axios response so callers can access headers and data (blob)
    },
  });
};
