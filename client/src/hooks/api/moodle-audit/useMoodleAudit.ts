import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

// Tipos espejo del informe del servidor (server/src/api/moodle-audit)

export interface AuditUserRef {
  id_user: number;
  name: string | null;
  first_surname: string | null;
  second_surname: string | null;
  dni: string | null;
  nss: string | null;
  email: string | null;
  courses_count: number;
  groups_count: number;
  moodle_count: number;
}

export interface AuditMoodleUser {
  moodle_id: number;
  username: string;
  fullname: string;
  email: string;
  suspended: boolean;
  dni_keys: string[];
}

export interface IncorrectLinkFinding {
  moodle: AuditMoodleUser;
  id_moodle_user: number;
  linkedUser: AuditUserRef;
  expectedUser: AuditUserRef;
  nameMatch: boolean;
}

export interface UnverifiableFinding {
  moodle: AuditMoodleUser;
  id_moodle_user: number;
  linkedUser: AuditUserRef;
  reason: "no-dni" | "dni-not-found";
}

export interface OrphanFinding {
  id_moodle_user: number;
  moodle_id: number;
  moodle_username: string;
  is_main_user: boolean;
  user: AuditUserRef | null;
  user_course_refs: number;
  token_links: number;
  other_accounts: number;
}

export interface NoCoursesFinding {
  moodle: AuditMoodleUser;
  id_moodle_user: number;
  linkedUser: AuditUserRef;
}

export interface UnlinkedFinding {
  moodle: AuditMoodleUser;
  wouldMatchUser: AuditUserRef | null;
}

export interface UsernameMismatchFinding {
  moodle: AuditMoodleUser;
  id_moodle_user: number;
  linkedUser: AuditUserRef;
  stored_username: string;
  real_username: string;
}

export interface UsernameFixResult {
  updated: number;
  errors: Array<{ id_moodle_user: number; stored_username: string; real_username: string; message: string }>;
}

export interface MoodleAuditReport {
  hasSnapshot: boolean;
  fetchedAt: string | null;
  snapshotSize: number;
  moodleCallsLastFetch: number | null;
  totals: {
    ok: number;
    incorrectLinks: number;
    unverifiable: number;
    orphans: number;
    noCourses: number;
    unlinked: number;
    usernameMismatches: number;
  };
  ok_count: number;
  incorrectLinks: IncorrectLinkFinding[];
  unverifiable: UnverifiableFinding[];
  orphans: OrphanFinding[];
  noCourses: NoCoursesFinding[];
  unlinked: UnlinkedFinding[];
  usernameMismatches: UsernameMismatchFinding[];
}

export interface OrphanCleanupResult {
  id_moodle_user: number;
  moodle_id: number;
  cleared_user_courses: number;
  deleted_token_links: number;
  promoted_id_moodle_user: number | null;
}

export const MOODLE_AUDIT_REPORT_KEY = ["moodle-audit-report"];

/** Informe recalculado contra la BD local (0 llamadas a Moodle). */
export const useMoodleAuditReportQuery = () => {
  const request = useAuthenticatedAxios();
  return useQuery({
    queryKey: MOODLE_AUDIT_REPORT_KEY,
    queryFn: async (): Promise<MoodleAuditReport> => {
      const res = await request({ method: "GET", url: `${getApiHost()}/api/moodle-audit/report` });
      return res.data as MoodleAuditReport;
    },
  });
};

/** Descarga el snapshot de usuarios de Moodle (consume cuota: ~1 + N/200 llamadas). */
export const useMoodleAuditRefreshMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<MoodleAuditReport> => {
      const res = await request({ method: "POST", url: `${getApiHost()}/api/moodle-audit/refresh` });
      return res.data as MoodleAuditReport;
    },
    onSuccess: data => {
      queryClient.setQueryData(MOODLE_AUDIT_REPORT_KEY, data);
    },
  });
};

/** Corrige moodle_usernames desactualizados (todos, o solo los indicados). El valor lo pone el servidor desde el snapshot. */
export const useFixUsernamesMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (idMoodleUsers?: number[]): Promise<UsernameFixResult> => {
      const res = await request({
        method: "POST",
        url: `${getApiHost()}/api/moodle-audit/fix-usernames`,
        data: idMoodleUsers && idMoodleUsers.length > 0 ? { idMoodleUsers } : {},
      });
      return res.data as UsernameFixResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOODLE_AUDIT_REPORT_KEY });
    },
  });
};

/** Elimina un vínculo huérfano (cuenta que ya no existe en Moodle). */
export const useOrphanCleanupMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (idMoodleUser: number): Promise<OrphanCleanupResult> => {
      const res = await request({
        method: "DELETE",
        url: `${getApiHost()}/api/moodle-audit/orphans/${idMoodleUser}`,
      });
      return res.data as OrphanCleanupResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOODLE_AUDIT_REPORT_KEY });
    },
  });
};
