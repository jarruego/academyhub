import { MoodleUser } from "src/types/moodle/user";
import { moodleUserDniKeys } from "src/api/moodle/moodle-user-matching.util";
import { normalizeName } from "src/api/user-merge/user-merge.util";

/** Resumen de un usuario local para el informe. */
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

/** Proyección mínima de un usuario del snapshot de Moodle para el informe. */
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
  /** Claves DNI normalizadas (customfield `dni` y/o `username` válido). */
  dni_keys: string[];
}

/** Fila de `moodle_users` enriquecida con contadores de referencias. */
export interface AuditLinkRow {
  id_moodle_user: number;
  id_user: number;
  moodle_id: number;
  moodle_username: string;
  is_main_user: boolean;
  /** Matrículas (`user_course`) que referencian esta cuenta. */
  user_course_refs: number;
  /** Vínculos con token (`moodle_user_auth_user`). */
  token_links: number;
  /** true si la fila ya está marcada como borrada en Moodle (lápida). */
  deleted_in_moodle: boolean;
}

/** Vínculo cuyo DNI en Moodle apunta a OTRO usuario local: candidato a fusión. */
export interface IncorrectLinkFinding {
  moodle: AuditMoodleUser;
  id_moodle_user: number;
  /** Usuario local actualmente vinculado (perdedor probable de la fusión). */
  linkedUser: AuditUserRef;
  /** Usuario local que casa por DNI (ganador probable de la fusión). */
  expectedUser: AuditUserRef;
  /** true si los nombres normalizados de ambos usuarios locales coinciden. */
  nameMatch: boolean;
}

/** Vínculo que no se puede verificar por DNI. */
export interface UnverifiableFinding {
  moodle: AuditMoodleUser;
  id_moodle_user: number;
  linkedUser: AuditUserRef;
  /** `no-dni`: Moodle no aporta DNI válido. `dni-not-found`: lo aporta pero no existe en la BD. */
  reason: "no-dni" | "dni-not-found";
}

/** Fila de `moodle_users` cuya cuenta ya no existe en Moodle. */
export interface OrphanFinding {
  id_moodle_user: number;
  moodle_id: number;
  moodle_username: string;
  is_main_user: boolean;
  user: AuditUserRef | null;
  user_course_refs: number;
  token_links: number;
  /** Otras cuentas Moodle del mismo usuario local (huérfanas o no). */
  other_accounts: number;
  /** true si la lápida ya está marcada (`deleted_in_moodle_at`) por la sincronización de estado. */
  marked_deleted: boolean;
}

/** Cuenta Moodle vinculada cuyo usuario local no tiene ningún curso en la BD. */
export interface NoCoursesFinding {
  moodle: AuditMoodleUser;
  id_moodle_user: number;
  linkedUser: AuditUserRef;
}

/** Vínculo correcto por `moodle_id` pero con `moodle_username` desactualizado. */
export interface UsernameMismatchFinding {
  moodle: AuditMoodleUser;
  id_moodle_user: number;
  linkedUser: AuditUserRef;
  /** Username guardado en la BD (obsoleto). */
  stored_username: string;
  /** Username real según Moodle. */
  real_username: string;
}

/** Usuario de Moodle sin fila en `moodle_users`. */
export interface UnlinkedFinding {
  moodle: AuditMoodleUser;
  /** Usuario local que casaría por DNI en el próximo import (si existe). */
  wouldMatchUser: AuditUserRef | null;
}

export interface MoodleAuditClassification {
  ok_count: number;
  incorrectLinks: IncorrectLinkFinding[];
  unverifiable: UnverifiableFinding[];
  orphans: OrphanFinding[];
  noCourses: NoCoursesFinding[];
  unlinked: UnlinkedFinding[];
  usernameMismatches: UsernameMismatchFinding[];
}

export interface ClassifyInput {
  snapshot: AuditMoodleUser[];
  links: AuditLinkRow[];
  usersById: Map<number, AuditUserRef>;
  /** `users.dni` normalizado (compacto-mayúsculas) → id_user. */
  userIdByDniKey: Map<string, number>;
}

/** Proyecta un usuario del snapshot de Moodle al formato del informe. */
export function toAuditMoodleUser(mu: MoodleUser): AuditMoodleUser {
  return {
    moodle_id: mu.id,
    username: mu.username,
    fullname: mu.fullname ?? [mu.firstname, mu.lastname].filter(Boolean).join(" "),
    email: mu.email ?? "",
    suspended: Boolean(mu.suspended),
    firstaccess: mu.firstaccess ?? 0,
    lastaccess: mu.lastaccess ?? 0,
    dni_keys: moodleUserDniKeys(mu),
  };
}

// ---------- limpieza: usuarios de Moodle sin ningún curso en Moodle ----------

export type ProtectedReason = "auth-user" | "tutor";

/** Usuario de Moodle sin matrículas en Moodle: candidato a borrado. */
export interface CleanupCandidate {
  moodle: AuditMoodleUser;
  /** Vínculo local si existe (null = Moodle no está en `moodle_users`). */
  id_moodle_user: number | null;
  linkedUser: AuditUserRef | null;
  /** true si nunca se ha conectado (firstaccess = 0). */
  never_accessed: boolean;
  /** Protegido contra borrado: gestor de la app o tutor de algún grupo. */
  protected: boolean;
  protected_reasons: ProtectedReason[];
}

export interface CleanupInput {
  snapshot: AuditMoodleUser[];
  /** Unión de matriculados de todos los cursos de Moodle. */
  enrolledMoodleIds: Set<number>;
  links: AuditLinkRow[];
  usersById: Map<number, AuditUserRef>;
  /** Emails y usernames (en minúsculas) de los `auth_users` de la app. */
  authUserKeys: Set<string>;
  /** id_user locales que son tutores en algún grupo (`user_group.is_tutor`). */
  tutorUserIds: Set<number>;
}

/**
 * Candidatos a borrado en Moodle: usuarios del snapshot que no aparecen
 * matriculados en NINGÚN curso de Moodle. Puro, sin llamadas ni BD. Protección
 * server-side (el borrado rechaza los `protected`):
 * - "auth-user": su email/username de Moodle coincide con un gestor de la app.
 * - "tutor": su vínculo local es tutor en algún grupo.
 * Los profesores/tutores matriculados en sus cursos nunca llegan aquí (tienen
 * cursos); esto cubre cuentas de gestión sin matrículas.
 */
export function classifyCleanupCandidates(input: CleanupInput): CleanupCandidate[] {
  const { snapshot, enrolledMoodleIds, links, usersById, authUserKeys, tutorUserIds } = input;

  const linkByMoodleId = new Map<number, AuditLinkRow>();
  for (const link of links) linkByMoodleId.set(link.moodle_id, link);

  const result: CleanupCandidate[] = [];
  for (const moodle of snapshot) {
    if (enrolledMoodleIds.has(moodle.moodle_id)) continue;

    const link = linkByMoodleId.get(moodle.moodle_id) ?? null;
    const linkedUser = link ? userRefOrPlaceholder(usersById, link.id_user) : null;

    const protected_reasons: ProtectedReason[] = [];
    if (authUserKeys.has(moodle.email.toLowerCase()) || authUserKeys.has(moodle.username.toLowerCase())) {
      protected_reasons.push("auth-user");
    }
    if (link && tutorUserIds.has(link.id_user)) {
      protected_reasons.push("tutor");
    }

    result.push({
      moodle,
      id_moodle_user: link?.id_moodle_user ?? null,
      linkedUser,
      never_accessed: moodle.firstaccess === 0,
      protected: protected_reasons.length > 0,
      protected_reasons,
    });
  }
  return result;
}

function userRefOrPlaceholder(usersById: Map<number, AuditUserRef>, idUser: number): AuditUserRef {
  return (
    usersById.get(idUser) ?? {
      id_user: idUser,
      name: null,
      first_surname: null,
      second_surname: null,
      dni: null,
      nss: null,
      email: null,
      courses_count: 0,
      groups_count: 0,
      moodle_count: 0,
    }
  );
}

/**
 * Clasificación pura del cruce snapshot de Moodle ↔ BD local. Sin llamadas ni
 * BD: todo llega precargado en mapas. Categorías (una cuenta puede caer en
 * `noCourses` además de su categoría de verificación):
 * - incorrectLinks: vinculada a un usuario local distinto del que casa por DNI.
 * - unverifiable: vinculada pero sin DNI con el que verificar.
 * - orphans: filas de `moodle_users` cuyo `moodle_id` no está en el snapshot.
 * - noCourses: vinculada y su usuario local no tiene ninguna fila en `user_course`.
 * - unlinked: cuentas de Moodle que la BD no conoce.
 * - usernameMismatches: dimensión independiente — el `moodle_username` guardado
 *   no coincide (comparación exacta) con el real de Moodle; se corrige con el
 *   endpoint de fix aunque el vínculo caiga además en otra categoría.
 */
export function classifyMoodleLinks(input: ClassifyInput): MoodleAuditClassification {
  const { snapshot, links, usersById, userIdByDniKey } = input;

  const linkByMoodleId = new Map<number, AuditLinkRow>();
  const linksByUserId = new Map<number, AuditLinkRow[]>();
  for (const link of links) {
    linkByMoodleId.set(link.moodle_id, link);
    const list = linksByUserId.get(link.id_user) ?? [];
    list.push(link);
    linksByUserId.set(link.id_user, list);
  }

  const result: MoodleAuditClassification = {
    ok_count: 0,
    incorrectLinks: [],
    unverifiable: [],
    orphans: [],
    noCourses: [],
    unlinked: [],
    usernameMismatches: [],
  };

  const snapshotIds = new Set<number>();
  for (const moodle of snapshot) {
    snapshotIds.add(moodle.moodle_id);
    const link = linkByMoodleId.get(moodle.moodle_id);

    // Usuario local que casa por DNI (primera clave con match, customfield primero)
    let expectedUserId: number | null = null;
    for (const key of moodle.dni_keys) {
      const id = userIdByDniKey.get(key);
      if (id !== undefined) {
        expectedUserId = id;
        break;
      }
    }

    if (!link) {
      result.unlinked.push({
        moodle,
        wouldMatchUser: expectedUserId !== null ? userRefOrPlaceholder(usersById, expectedUserId) : null,
      });
      continue;
    }

    const linkedUser = userRefOrPlaceholder(usersById, link.id_user);

    if (moodle.dni_keys.length === 0) {
      result.unverifiable.push({ moodle, id_moodle_user: link.id_moodle_user, linkedUser, reason: "no-dni" });
    } else if (expectedUserId === null) {
      result.unverifiable.push({ moodle, id_moodle_user: link.id_moodle_user, linkedUser, reason: "dni-not-found" });
    } else if (expectedUserId !== link.id_user) {
      const expectedUser = userRefOrPlaceholder(usersById, expectedUserId);
      result.incorrectLinks.push({
        moodle,
        id_moodle_user: link.id_moodle_user,
        linkedUser,
        expectedUser,
        nameMatch:
          normalizeName(linkedUser.name, linkedUser.first_surname, linkedUser.second_surname) ===
          normalizeName(expectedUser.name, expectedUser.first_surname, expectedUser.second_surname),
      });
    } else {
      result.ok_count++;
    }

    if (linkedUser.courses_count === 0) {
      result.noCourses.push({ moodle, id_moodle_user: link.id_moodle_user, linkedUser });
    }

    if (link.moodle_username !== moodle.username) {
      result.usernameMismatches.push({
        moodle,
        id_moodle_user: link.id_moodle_user,
        linkedUser,
        stored_username: link.moodle_username,
        real_username: moodle.username,
      });
    }
  }

  for (const link of links) {
    if (snapshotIds.has(link.moodle_id)) continue;
    const siblings = linksByUserId.get(link.id_user) ?? [];
    result.orphans.push({
      id_moodle_user: link.id_moodle_user,
      moodle_id: link.moodle_id,
      moodle_username: link.moodle_username,
      is_main_user: link.is_main_user,
      user: usersById.get(link.id_user) ?? null,
      user_course_refs: link.user_course_refs,
      token_links: link.token_links,
      other_accounts: siblings.filter(s => s.id_moodle_user !== link.id_moodle_user).length,
      marked_deleted: link.deleted_in_moodle,
    });
  }

  return result;
}
