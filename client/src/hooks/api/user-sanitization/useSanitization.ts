import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export type SanitizableField = "phone" | "email" | "dni" | "nss";
export type AutoFixableField = "phone" | "email" | "nss";

export interface UserIssue {
  field: SanitizableField;
  value: string;
  fixable: boolean;
  suggestion: string | null;
}

export interface UserWithIssues {
  id_user: number;
  name: string;
  first_surname: string | null;
  second_surname: string | null;
  baja: boolean;
  issues: UserIssue[];
}

export const useSanitizationIssuesQuery = () => {
  const request = useAuthenticatedAxios();
  return useQuery({
    queryKey: ["sanitization-issues"],
    queryFn: async (): Promise<UserWithIssues[]> => {
      const res = await request({ method: "GET", url: `${getApiHost()}/api/user-sanitization/issues` });
      return res.data as UserWithIssues[];
    },
  });
};

export const useFixIssueMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, field }: { id: number; field: AutoFixableField }) => {
      const res = await request({
        method: "POST",
        url: `${getApiHost()}/api/user-sanitization/${id}/fix`,
        data: { field },
      });
      return res.data as { id_user: number; field: AutoFixableField; value: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sanitization-issues"] });
    },
  });
};

export const useManualFixMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, field, value }: { id: number; field: SanitizableField; value: string }) => {
      const res = await request({
        method: "POST",
        url: `${getApiHost()}/api/user-sanitization/${id}/manual`,
        data: { field, value },
      });
      return res.data as { id_user: number; field: SanitizableField; value: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sanitization-issues"] });
    },
  });
};

export interface FixAllResult {
  fixed: number;
  failed: { id_user: number; value: string; suggestion: string }[];
}

export const useFixAllMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ field }: { field: AutoFixableField }): Promise<FixAllResult> => {
      const res = await request({
        method: "POST",
        url: `${getApiHost()}/api/user-sanitization/fix-all`,
        data: { field },
      });
      return res.data as FixAllResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sanitization-issues"] });
    },
  });
};
