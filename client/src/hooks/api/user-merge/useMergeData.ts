import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export interface MergeCandidateMember {
  id_user: number;
  name: string;
  first_surname: string | null;
  second_surname: string | null;
  dni: string | null;
  nss: string | null;
  email: string | null;
  courses_count: number;
  groups_count: number;
  centers_count: number;
  preinscriptions_count: number;
  moodle_count: number;
}

export interface MergeCandidateGroup {
  nss_norm: string;
  members: MergeCandidateMember[];
  nameMatch: boolean;
}

export interface MergeFieldDiff {
  field: string;
  winnerValue: unknown;
  loserValue: unknown;
  differ: boolean;
  winnerEmpty: boolean;
}

export interface MergeResolvedNss {
  winnerNss: string | null;
  loserNss: string | null;
  value: string | null;
  from: "winner" | "loser" | null;
  valid: boolean;
}

export interface MergePreview {
  winner: { id_user: number; name: string; first_surname: string | null; second_surname: string | null; dni: string | null; nss: string | null };
  loser: { id_user: number; name: string; first_surname: string | null; second_surname: string | null; dni: string | null; nss: string | null };
  fields: MergeFieldDiff[];
  resolvedNss: MergeResolvedNss;
  collisions: { courses: number; groups: number; centers: number; preinscriptions: number };
  dualMoodle: boolean;
}

export const useMergeCandidatesQuery = () => {
  const request = useAuthenticatedAxios();
  return useQuery({
    queryKey: ["merge-candidates"],
    queryFn: async (): Promise<MergeCandidateGroup[]> => {
      const res = await request({ method: "GET", url: `${getApiHost()}/api/user-merge/candidates` });
      return res.data as MergeCandidateGroup[];
    },
  });
};

export const useMergePreviewQuery = (winnerId: number | null, loserId: number | null) => {
  const request = useAuthenticatedAxios();
  return useQuery({
    queryKey: ["merge-preview", winnerId, loserId],
    queryFn: async (): Promise<MergePreview> => {
      const res = await request({ method: "GET", url: `${getApiHost()}/api/user-merge/preview/${winnerId}/${loserId}` });
      return res.data as MergePreview;
    },
    enabled: winnerId !== null && loserId !== null,
    staleTime: 0,
  });
};

export const useMergeMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ winnerId, loserId, fieldsFromLoser }: { winnerId: number; loserId: number; fieldsFromLoser: string[] }) => {
      const res = await request({
        method: "POST",
        url: `${getApiHost()}/api/user-merge/${winnerId}/${loserId}`,
        data: { fieldsFromLoser },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merge-candidates"] });
      // La Auditoría de Moodle también fusiona; su informe queda obsoleto tras cualquier fusión.
      queryClient.invalidateQueries({ queryKey: ["moodle-audit-report"] });
    },
  });
};
