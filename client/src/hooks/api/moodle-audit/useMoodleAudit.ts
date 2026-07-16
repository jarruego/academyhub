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
  /** Epoch en segundos del primer acceso (0 = nunca se ha conectado). */
  firstaccess: number;
  /** Epoch en segundos del último acceso (0 = nunca se ha conectado). */
  lastaccess: number;
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
  /** true si la lápida ya está marcada (deleted_in_moodle_at). */
  marked_deleted: boolean;
}

export type ProtectedReason = "auth-user" | "tutor" | "manual";

/** Curso de Moodle en el informe (pestaña informativa, sin acciones). */
export interface MoodleCourseRow {
  moodle_id: number;
  fullname: string;
  shortname: string;
  visible: boolean;
  /** Epoch en segundos (0 = sin fecha). */
  startdate: number;
  enddate: number;
  timecreated: number;
  enrolled_count: number;
  localCourse: { id_course: number; course_name: string } | null;
}

export interface CleanupCandidate {
  moodle: AuditMoodleUser;
  id_moodle_user: number | null;
  linkedUser: AuditUserRef | null;
  never_accessed: boolean;
  protected: boolean;
  protected_reasons: ProtectedReason[];
}

export interface SyncStatusResult {
  suspended_updated: number;
  deleted_marked: number;
}

export interface DeleteFromMoodleResult {
  deleted: number;
  marked_local: number;
  errors: Array<{ moodle_id: number; message: string }>;
  moodleCalls: number;
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
  /** Estado del snapshot de matrículas de Moodle (null = no descargado). */
  enrolments: { fetchedAt: string; courseCount: number; moodleCalls: number } | null;
  /** Usuarios de Moodle sin ningún curso en Moodle (vacío sin snapshot de matrículas). */
  cleanupCandidates: CleanupCandidate[];
  /** Cursos de Moodle con su estado y matriculados (informativo). */
  moodleCourses: MoodleCourseRow[];
  totals: {
    ok: number;
    incorrectLinks: number;
    unverifiable: number;
    orphans: number;
    noCourses: number;
    unlinked: number;
    usernameMismatches: number;
    cleanupCandidates: number;
  };
  ok_count: number;
  incorrectLinks: IncorrectLinkFinding[];
  unverifiable: UnverifiableFinding[];
  orphans: OrphanFinding[];
  noCourses: NoCoursesFinding[];
  unlinked: UnlinkedFinding[];
  usernameMismatches: UsernameMismatchFinding[];
}

export interface RelinkResult {
  id_moodle_user: number;
  moodle_id: number;
  from_user: number;
  to_user: number;
  courses: { moved: number; merged: number };
  groups: { moved: number; merged: number };
  promoted_id_moodle_user: number | null;
  is_main_for_target: boolean;
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

/** Marca/desmarca una cuenta de Moodle como intocable para la limpieza. */
export const useProtectMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ moodleId, protect }: { moodleId: number; protect: boolean }) => {
      const res = await request({
        method: protect ? "POST" : "DELETE",
        url: `${getApiHost()}/api/moodle-audit/protected/${moodleId}`,
      });
      return res.data as { moodle_id: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOODLE_AUDIT_REPORT_KEY });
    },
  });
};

/** Descarga el snapshot de matrículas de Moodle (1 llamada por curso + 1 para el catálogo). */
export const useRefreshEnrolmentsMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<MoodleAuditReport> => {
      const res = await request({ method: "POST", url: `${getApiHost()}/api/moodle-audit/refresh-enrolments` });
      return res.data as MoodleAuditReport;
    },
    onSuccess: data => {
      queryClient.setQueryData(MOODLE_AUDIT_REPORT_KEY, data);
    },
  });
};

/** Sincroniza a la BD el estado de las cuentas según el snapshot (0 llamadas): suspended + lápidas. */
export const useSyncStatusMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<SyncStatusResult> => {
      const res = await request({ method: "POST", url: `${getApiHost()}/api/moodle-audit/sync-status` });
      return res.data as SyncStatusResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOODLE_AUDIT_REPORT_KEY });
    },
  });
};

/** Borra usuarios EN MOODLE (irreversible) y marca la lápida local. */
export const useDeleteFromMoodleMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (moodleIds: number[]): Promise<DeleteFromMoodleResult> => {
      const res = await request({
        method: "POST",
        url: `${getApiHost()}/api/moodle-audit/delete-users`,
        data: { moodleIds },
      });
      return res.data as DeleteFromMoodleResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOODLE_AUDIT_REPORT_KEY });
    },
  });
};

/**
 * Reasigna un vínculo incorrecto al usuario correcto por DNI sin fusionar fichas:
 * mueve la cuenta de Moodle, sus matrículas y las membresías de esos cursos.
 * El destino lo deriva el servidor del snapshot; nadie se borra.
 */
export const useRelinkMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (idMoodleUser: number): Promise<RelinkResult> => {
      const res = await request({
        method: "POST",
        url: `${getApiHost()}/api/moodle-audit/relink/${idMoodleUser}`,
      });
      return res.data as RelinkResult;
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
