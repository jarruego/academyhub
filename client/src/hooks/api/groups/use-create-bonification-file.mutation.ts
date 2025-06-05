import { useMutation } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

interface BonificationFileRequest {
  groupId: number;
  userIds: number[];
}
//TODO: REVISAR, NO FUNCIONA.
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
      return response.data as Blob;
    },
  });
};
