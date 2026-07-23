import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export type UploadCourseRequestExcelResult = { inserted: number; matchedFields: string[] };

export const useUploadCourseRequestExcelMutation = (id_request: number) => {
  const request = useAuthenticatedAxios<UploadCourseRequestExcelResult, FormData>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: Blob) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await request({
        method: "POST",
        url: `${getApiHost()}/api/course-requests/${id_request}/upload`,
        data: fd,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-requests", "detail", id_request] });
      queryClient.invalidateQueries({ queryKey: ["course-requests"] });
    },
  });
};
