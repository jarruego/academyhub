import { useMutation } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { CourseRequestReportFilters } from "../../../shared/types/course-request/course-request-report";

/** Descarga el PDF del informe y dispara la descarga en el navegador. */
export const useCourseRequestReportPdfMutation = () => {
  const request = useAuthenticatedAxios<Blob>();

  return useMutation({
    mutationFn: async (filters: CourseRequestReportFilters) => {
      const response = await request({
        method: "GET",
        url: `${getApiHost()}/api/course-requests/report/pdf`,
        params: filters,
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "informe-peticiones.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    },
  });
};
