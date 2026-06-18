import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuthInfo } from "../../../providers/auth/auth.context";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export interface InaemSummary {
  coursesCreated: number;
  coursesUpdated: number;
  usersCreated: number;
  usersUpdated: number;
  enrollments: number;
  preinscriptions: number;
  conflicts: number;
  failed: number;
}

export interface InaemJobStatus {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  totalRows: number;
  processedRows: number;
  errorMessage?: string;
  completedAt?: string;
  resultSummary?: InaemSummary;
}

interface UploadResponse {
  jobId: string;
  message: string;
}

const uploadInaem = async (formData: FormData, token: string): Promise<UploadResponse> => {
  const response = await fetch(`${getApiHost()}/api/import-inaem/upload`, {
    method: "POST",
    body: formData,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Error ${response.status}: ${response.statusText}`);
  }
  return response.json();
};

export const useInaemImportUpload = () => {
  const { authInfo: { token } } = useAuthInfo();
  return useMutation({ mutationFn: (formData: FormData) => uploadInaem(formData, token) });
};

export const useInaemJobStatus = (
  jobId: string | null,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) => {
  const { authInfo: { token } } = useAuthInfo();
  return useQuery({
    queryKey: ["inaem-job-status", jobId],
    queryFn: async (): Promise<InaemJobStatus> => {
      const response = await fetch(`${getApiHost()}/api/import-inaem/job-status/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
      return response.json();
    },
    enabled: !!jobId && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval,
    retry: 3,
    retryDelay: 1000,
  });
};
