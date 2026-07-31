import { useMutation } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import type { ReportsQueryParams } from "./use-reports.query";

export type ReportSendGroupKind = 'request' | 'center';

export interface ReportSendGroupPreview {
  group_key: string;
  kind: ReportSendGroupKind;
  center_name: string;
  course_name: string | null;
  student_count: number;
  eligible_count: number;
  suggested_email: string | null;
  row_keys: string[];
  eligible_row_keys: string[];
}

export interface ReportSendGroupsPreview {
  groups: ReportSendGroupPreview[];
  unassignable_count: number;
}

export type ReportSendGroupsSelection = {
  filter?: ReportsQueryParams;
  selected_keys?: string[];
  select_all_matching?: boolean;
  deselected_keys?: string[];
};

/**
 * Resuelve la selección a los grupos de envío: por petición (con su
 * contact_email como sugerencia) o, para quien no venga de ninguna, por
 * centro (fallback, sin sugerencia). No envía nada.
 */
export const useReportSendGroupsMutation = () => {
  const request = useAuthenticatedAxios<ReportSendGroupsPreview>();

  return useMutation({
    mutationFn: async (selection: ReportSendGroupsSelection) => {
      const { data } = await request({
        method: 'POST',
        url: `${getApiHost()}/reports/send/groups`,
        data: selection,
      });
      return data;
    },
  });
};
