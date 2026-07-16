import { ConflictException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";
import {
  users,
  moodle_users,
  user_course,
  user_groups,
  groups,
  courses,
  moodle_user_auth_user,
  auth_users,
  moodle_audit_snapshot,
  moodle_protected_users,
} from "src/database/schema";
import { eq, isNotNull, isNull, ne, and, sql, inArray } from "drizzle-orm";
import { MoodleService } from "src/api/moodle/moodle.service";
import { compactDniKey } from "src/api/moodle/moodle-user-matching.util";
import { mergeUserCourseRow, mergeUserGroupRow } from "src/api/user-merge/user-merge.util";
import {
  AuditLinkRow,
  AuditMoodleCourse,
  AuditMoodleUser,
  AuditUserRef,
  classifyCleanupCandidates,
  classifyMoodleLinks,
  CleanupCandidate,
  MoodleAuditClassification,
  toAuditMoodleUser,
} from "./moodle-audit.util";

export interface MoodleAuditReport extends MoodleAuditClassification {
  hasSnapshot: boolean;
  /** Momento de la última descarga del snapshot de Moodle. */
  fetchedAt: string | null;
  /** Usuarios (no borrados) que devolvió Moodle en el snapshot. */
  snapshotSize: number;
  /** Llamadas a Moodle que costó la última descarga. */
  moodleCallsLastFetch: number | null;
  /** Estado del snapshot de matrículas de Moodle (null = no descargado). */
  enrolments: { fetchedAt: string; courseCount: number; moodleCalls: number } | null;
  /** Usuarios de Moodle sin ningún curso en Moodle (vacío sin snapshot de matrículas). */
  cleanupCandidates: CleanupCandidate[];
  /** Cursos de Moodle con su estado y matriculados (informativo, sin acciones). */
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
}

export interface UsernameFixResult {
  updated: number;
  errors: Array<{ id_moodle_user: number; stored_username: string; real_username: string; message: string }>;
}

/** Curso de Moodle proyectado para la pestaña informativa (sin la lista de ids). */
export interface MoodleCourseRow {
  moodle_id: number;
  fullname: string;
  shortname: string;
  visible: boolean;
  startdate: number;
  enddate: number;
  timecreated: number;
  enrolled_count: number;
  /** Curso de AcademyHub con el mismo moodle_id, si existe. */
  localCourse: { id_course: number; course_name: string } | null;
}

export interface SyncStatusResult {
  /** Vínculos cuyo flag `suspended` ha cambiado (en cualquier dirección). */
  suspended_updated: number;
  /** Lápidas nuevas: vínculos marcados `deleted_in_moodle_at` (no estaban en el snapshot). */
  deleted_marked: number;
}

export interface DeleteFromMoodleResult {
  /** Usuarios borrados en Moodle. */
  deleted: number;
  /** Lápidas marcadas en `moodle_users` (los borrados que tenían vínculo local). */
  marked_local: number;
  errors: Array<{ moodle_id: number; message: string }>;
  /** Llamadas a Moodle consumidas por el borrado. */
  moodleCalls: number;
}

export interface RelinkResult {
  id_moodle_user: number;
  moodle_id: number;
  /** Usuario local que tenía el vínculo (se conserva, NO se borra). */
  from_user: number;
  /** Usuario local correcto por DNI al que se reasigna la cuenta. */
  to_user: number;
  /** Matrículas de esta cuenta movidas al destino / fusionadas con una existente. */
  courses: { moved: number; merged: number };
  /** Membresías de grupo (de los cursos movidos) movidas / fusionadas. */
  groups: { moved: number; merged: number };
  /** Cuenta promovida a principal del usuario origen, si la reasignada lo era. */
  promoted_id_moodle_user: number | null;
  /** true si la cuenta reasignada queda como principal del usuario destino. */
  is_main_for_target: boolean;
}

export interface OrphanCleanupResult {
  id_moodle_user: number;
  moodle_id: number;
  /** Matrículas cuyo `id_moodle_user` se ha puesto a NULL (se conservan). */
  cleared_user_courses: number;
  /** Vínculos con token borrados. */
  deleted_token_links: number;
  /** Cuenta promovida a principal del usuario local, si la borrada lo era. */
  promoted_id_moodle_user: number | null;
}

/**
 * Auditoría de vínculos Moodle ↔ BD local. Los snapshots (usuarios y
 * matrículas) se descargan explícitamente (`refreshSnapshot` ~1 + N/200
 * llamadas; `refreshEnrolments` ~1 + C llamadas), se cachean en memoria y se
 * **persisten en `moodle_audit_snapshot`** para sobrevivir a reinicios (carga
 * perezosa vía `ensureLoaded`, 0 llamadas). El informe y todas las
 * reparaciones trabajan solo contra la BD local (0 llamadas).
 */
@Injectable()
export class MoodleAuditService {
  private snapshot: {
    fetchedAt: Date;
    users: AuditMoodleUser[];
    moodleIds: Set<number>;
    moodleCalls: number;
  } | null = null;

  /** Snapshot de matrículas: cursos de Moodle con sus matriculados. */
  private enrolSnapshot: {
    fetchedAt: Date;
    courses: AuditMoodleCourse[];
    enrolledMoodleIds: Set<number>;
    moodleCalls: number;
  } | null = null;

  /** true cuando ya se intentó cargar los snapshots persistidos en BD. */
  private snapshotsLoaded = false;

  constructor(
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService,
    private readonly moodleService: MoodleService,
  ) {}

  private get db() {
    return this.databaseService.db;
  }

  /**
   * Carga perezosa de los snapshots persistidos (`moodle_audit_snapshot`): los
   * snapshots sobreviven a reinicios del servidor sin gastar llamadas. Solo se
   * consulta la BD la primera vez; después manda la copia en memoria.
   */
  private async ensureLoaded(): Promise<void> {
    if (this.snapshotsLoaded) return;
    this.snapshotsLoaded = true;
    const rows = await this.db.select().from(moodle_audit_snapshot);
    for (const row of rows) {
      if (row.kind === "users" && !this.snapshot) {
        const snapshotUsers = row.payload as AuditMoodleUser[];
        this.snapshot = {
          fetchedAt: row.fetched_at,
          users: snapshotUsers,
          moodleIds: new Set(snapshotUsers.map(u => u.moodle_id)),
          moodleCalls: row.moodle_calls,
        };
      } else if (row.kind === "enrolments" && !this.enrolSnapshot) {
        const payload = row.payload as { courses: AuditMoodleCourse[] };
        this.enrolSnapshot = {
          fetchedAt: row.fetched_at,
          courses: payload.courses,
          enrolledMoodleIds: new Set(payload.courses.flatMap(c => c.enrolled_ids)),
          moodleCalls: row.moodle_calls,
        };
      }
    }
    if (rows.length > 0) {
      Logger.log(
        { users: this.snapshot?.users.length ?? null, courses: this.enrolSnapshot?.courses.length ?? null },
        "MoodleAuditService:ensureLoaded - snapshots restaurados de la BD",
      );
    }
  }

  private async persistSnapshot(kind: "users" | "enrolments", fetchedAt: Date, moodleCalls: number, payload: unknown): Promise<void> {
    await this.db
      .insert(moodle_audit_snapshot)
      .values({ kind, fetched_at: fetchedAt, moodle_calls: moodleCalls, payload })
      .onConflictDoUpdate({
        target: moodle_audit_snapshot.kind,
        set: { fetched_at: fetchedAt, moodle_calls: moodleCalls, payload },
      });
  }

  /** Descarga el snapshot de usuarios de Moodle y lo persiste en BD. */
  async refreshSnapshot(): Promise<MoodleAuditReport> {
    await this.ensureLoaded();
    const callsBefore = this.moodleService.moodleCallCount;
    const moodleUsers = await this.moodleService.getAllUsers();
    const auditUsers = moodleUsers.map(toAuditMoodleUser);
    this.snapshot = {
      fetchedAt: new Date(),
      users: auditUsers,
      moodleIds: new Set(auditUsers.map(u => u.moodle_id)),
      moodleCalls: this.moodleService.moodleCallCount - callsBefore,
    };
    await this.persistSnapshot("users", this.snapshot.fetchedAt, this.snapshot.moodleCalls, auditUsers);
    Logger.log(
      { snapshotSize: auditUsers.length, moodleCalls: this.snapshot.moodleCalls },
      "MoodleAuditService:refreshSnapshot",
    );
    return this.buildReport();
  }

  /** Informe recalculado contra la BD local con el snapshot cacheado (0 llamadas a Moodle). */
  async getReport(): Promise<MoodleAuditReport> {
    await this.ensureLoaded();
    if (!this.snapshot) {
      return {
        hasSnapshot: false,
        fetchedAt: null,
        snapshotSize: 0,
        moodleCallsLastFetch: null,
        enrolments: this.enrolmentsInfo(),
        cleanupCandidates: [],
        moodleCourses: await this.buildCourseRows(),
        totals: { ok: 0, incorrectLinks: 0, unverifiable: 0, orphans: 0, noCourses: 0, unlinked: 0, usernameMismatches: 0, cleanupCandidates: 0 },
        ok_count: 0,
        incorrectLinks: [],
        unverifiable: [],
        orphans: [],
        noCourses: [],
        unlinked: [],
        usernameMismatches: [],
      };
    }
    return this.buildReport();
  }

  private enrolmentsInfo(): MoodleAuditReport["enrolments"] {
    if (!this.enrolSnapshot) return null;
    return {
      fetchedAt: this.enrolSnapshot.fetchedAt.toISOString(),
      courseCount: this.enrolSnapshot.courses.length,
      moodleCalls: this.enrolSnapshot.moodleCalls,
    };
  }

  /** Cursos de Moodle cruzados con los cursos locales por moodle_id (informativo). */
  private async buildCourseRows(): Promise<MoodleCourseRow[]> {
    if (!this.enrolSnapshot) return [];
    const localCourses = await this.db
      .select({ id_course: courses.id_course, course_name: courses.course_name, moodle_id: courses.moodle_id })
      .from(courses)
      .where(isNotNull(courses.moodle_id));
    const localByMoodleId = new Map(localCourses.map(c => [c.moodle_id as number, c]));
    return this.enrolSnapshot.courses.map(c => {
      const local = localByMoodleId.get(c.moodle_id);
      return {
        moodle_id: c.moodle_id,
        fullname: c.fullname,
        shortname: c.shortname,
        visible: c.visible,
        startdate: c.startdate,
        enddate: c.enddate,
        timecreated: c.timecreated,
        enrolled_count: c.enrolled_count,
        localCourse: local ? { id_course: local.id_course, course_name: local.course_name } : null,
      };
    });
  }

  /**
   * Descarga el snapshot de matrículas: 1 llamada para el catálogo de cursos +
   * 1 llamada ligera (`userfields=id`) por curso. Es la segunda operación con
   * coste de la herramienta; todo el filtrado posterior es local.
   */
  async refreshEnrolments(): Promise<MoodleAuditReport> {
    await this.ensureLoaded();
    const callsBefore = this.moodleService.moodleCallCount;
    const moodleCourses = await this.moodleService.getAllCourses();
    const auditCourses: AuditMoodleCourse[] = [];
    for (const course of moodleCourses) {
      // El curso 1 es la portada del sitio en Moodle: no es un curso real.
      if (course.id === 1) continue;
      try {
        const ids = await this.moodleService.getEnrolledUserIds(course.id);
        auditCourses.push({
          moodle_id: course.id,
          fullname: course.fullname,
          shortname: course.shortname,
          visible: Boolean(course.visible),
          startdate: course.startdate ?? 0,
          enddate: course.enddate ?? 0,
          timecreated: course.timecreated ?? 0,
          enrolled_count: ids.length,
          enrolled_ids: ids,
        });
      } catch (err) {
        // Fallar cerrado: si un curso no se puede leer, sus matriculados no
        // contarían y saldrían como falsos candidatos a borrado.
        Logger.error({ err, courseId: course.id }, "MoodleAuditService:refreshEnrolments - curso fallido");
        throw new ConflictException(
          `No se pudieron leer los matriculados del curso ${course.id} de Moodle: snapshot de matrículas descartado (habría falsos candidatos a borrado)`,
        );
      }
    }
    this.enrolSnapshot = {
      fetchedAt: new Date(),
      courses: auditCourses,
      enrolledMoodleIds: new Set(auditCourses.flatMap(c => c.enrolled_ids)),
      moodleCalls: this.moodleService.moodleCallCount - callsBefore,
    };
    await this.persistSnapshot("enrolments", this.enrolSnapshot.fetchedAt, this.enrolSnapshot.moodleCalls, { courses: auditCourses });
    Logger.log(
      { courses: auditCourses.length, enrolled: this.enrolSnapshot.enrolledMoodleIds.size, moodleCalls: this.enrolSnapshot.moodleCalls },
      "MoodleAuditService:refreshEnrolments",
    );
    return this.getReport();
  }

  private async buildReport(): Promise<MoodleAuditReport> {
    const snapshot = this.snapshot!;

    // Todo en bulk: nada de consultas por usuario.
    const [linkRows, ucRefRows, tokenRefRows, userRows, courseCountRows, groupCountRows, authUserRows, tutorRows, protectedRows] = await Promise.all([
      this.db
        .select({
          id_moodle_user: moodle_users.id_moodle_user,
          id_user: moodle_users.id_user,
          moodle_id: moodle_users.moodle_id,
          moodle_username: moodle_users.moodle_username,
          is_main_user: moodle_users.is_main_user,
          deleted_in_moodle_at: moodle_users.deleted_in_moodle_at,
        })
        .from(moodle_users),
      this.db
        .select({ id_moodle_user: user_course.id_moodle_user, c: sql<number>`count(*)` })
        .from(user_course)
        .where(isNotNull(user_course.id_moodle_user))
        .groupBy(user_course.id_moodle_user),
      this.db
        .select({ id_moodle_user: moodle_user_auth_user.id_moodle_user, c: sql<number>`count(*)` })
        .from(moodle_user_auth_user)
        .groupBy(moodle_user_auth_user.id_moodle_user),
      this.db
        .select({
          id_user: users.id_user,
          name: users.name,
          first_surname: users.first_surname,
          second_surname: users.second_surname,
          dni: users.dni,
          nss: users.nss,
          email: users.email,
        })
        .from(users),
      this.db
        .select({ id_user: user_course.id_user, c: sql<number>`count(*)` })
        .from(user_course)
        .groupBy(user_course.id_user),
      this.db
        .select({ id_user: user_groups.id_user, c: sql<number>`count(*)` })
        .from(user_groups)
        .groupBy(user_groups.id_user),
      this.db.select({ email: auth_users.email, username: auth_users.username }).from(auth_users),
      this.db
        .selectDistinct({ id_user: user_groups.id_user })
        .from(user_groups)
        .where(eq(user_groups.is_tutor, true)),
      this.db.select({ moodle_id: moodle_protected_users.moodle_id }).from(moodle_protected_users),
    ]);

    const ucRefs = new Map<number, number>();
    for (const r of ucRefRows) if (r.id_moodle_user !== null) ucRefs.set(r.id_moodle_user, Number(r.c));
    const tokenRefs = new Map<number, number>();
    for (const r of tokenRefRows) tokenRefs.set(r.id_moodle_user, Number(r.c));
    const courseCounts = new Map<number, number>();
    for (const r of courseCountRows) courseCounts.set(r.id_user, Number(r.c));
    const groupCounts = new Map<number, number>();
    for (const r of groupCountRows) groupCounts.set(r.id_user, Number(r.c));
    const moodleCounts = new Map<number, number>();
    for (const l of linkRows) moodleCounts.set(l.id_user, (moodleCounts.get(l.id_user) ?? 0) + 1);

    const links: AuditLinkRow[] = linkRows.map(l => ({
      id_moodle_user: l.id_moodle_user,
      id_user: l.id_user,
      moodle_id: l.moodle_id,
      moodle_username: l.moodle_username,
      is_main_user: l.is_main_user,
      user_course_refs: ucRefs.get(l.id_moodle_user) ?? 0,
      token_links: tokenRefs.get(l.id_moodle_user) ?? 0,
      deleted_in_moodle: l.deleted_in_moodle_at !== null,
    }));

    const usersById = new Map<number, AuditUserRef>();
    const userIdByDniKey = new Map<string, number>();
    for (const u of userRows) {
      usersById.set(u.id_user, {
        ...u,
        courses_count: courseCounts.get(u.id_user) ?? 0,
        groups_count: groupCounts.get(u.id_user) ?? 0,
        moodle_count: moodleCounts.get(u.id_user) ?? 0,
      });
      const key = compactDniKey(u.dni);
      if (key) userIdByDniKey.set(key, u.id_user);
    }

    const classification = classifyMoodleLinks({ snapshot: snapshot.users, links, usersById, userIdByDniKey });

    // Candidatos a limpieza solo si hay snapshot de matrículas (si no, vacío)
    const cleanupCandidates = this.enrolSnapshot
      ? classifyCleanupCandidates({
          snapshot: snapshot.users,
          enrolledMoodleIds: this.enrolSnapshot.enrolledMoodleIds,
          links,
          usersById,
          authUserKeys: new Set(
            authUserRows.flatMap(a => [a.email.toLowerCase(), a.username.toLowerCase()]),
          ),
          tutorUserIds: new Set(tutorRows.map(t => t.id_user)),
          manuallyProtectedIds: new Set(protectedRows.map(p => p.moodle_id)),
        })
      : [];

    return {
      hasSnapshot: true,
      fetchedAt: snapshot.fetchedAt.toISOString(),
      snapshotSize: snapshot.users.length,
      moodleCallsLastFetch: snapshot.moodleCalls,
      enrolments: this.enrolmentsInfo(),
      cleanupCandidates,
      moodleCourses: await this.buildCourseRows(),
      totals: {
        ok: classification.ok_count,
        incorrectLinks: classification.incorrectLinks.length,
        unverifiable: classification.unverifiable.length,
        orphans: classification.orphans.length,
        noCourses: classification.noCourses.length,
        unlinked: classification.unlinked.length,
        usernameMismatches: classification.usernameMismatches.length,
        cleanupCandidates: cleanupCandidates.length,
      },
      ...classification,
    };
  }

  /**
   * Sincroniza a la BD el estado de las cuentas según el snapshot (0 llamadas):
   * - `suspended`: espejo del flag de Moodle para las cuentas vivas.
   * - `deleted_in_moodle_at`: lápida para los vínculos cuyo `moodle_id` ya no
   *   existe en Moodle (los ids no se reutilizan, el marcado es seguro).
   * La fila se CONSERVA como histórico; la limpieza física de huérfanos sigue
   * disponible aparte para quien quiera deshacerse del registro.
   */
  async syncStatus(): Promise<SyncStatusResult> {
    await this.ensureLoaded();
    if (!this.snapshot) {
      throw new ConflictException("No hay snapshot de Moodle: ejecuta primero el diagnóstico");
    }
    const suspendedByMoodleId = new Map(this.snapshot.users.map(u => [u.moodle_id, u.suspended]));

    const links = await this.db
      .select({
        id_moodle_user: moodle_users.id_moodle_user,
        moodle_id: moodle_users.moodle_id,
        suspended: moodle_users.suspended,
        deleted_in_moodle_at: moodle_users.deleted_in_moodle_at,
      })
      .from(moodle_users);

    const toSuspend: number[] = [];
    const toUnsuspend: number[] = [];
    const toMarkDeleted: number[] = [];
    for (const link of links) {
      const realSuspended = suspendedByMoodleId.get(link.moodle_id);
      if (realSuspended === undefined) {
        // No está en el snapshot: la cuenta ya no existe en Moodle
        if (link.deleted_in_moodle_at === null) toMarkDeleted.push(link.id_moodle_user);
        continue;
      }
      if (realSuspended !== link.suspended) {
        (realSuspended ? toSuspend : toUnsuspend).push(link.id_moodle_user);
      }
    }

    await this.db.transaction(async tx => {
      if (toSuspend.length > 0) {
        await tx.update(moodle_users).set({ suspended: true }).where(inArray(moodle_users.id_moodle_user, toSuspend));
      }
      if (toUnsuspend.length > 0) {
        await tx.update(moodle_users).set({ suspended: false }).where(inArray(moodle_users.id_moodle_user, toUnsuspend));
      }
      if (toMarkDeleted.length > 0) {
        await tx
          .update(moodle_users)
          .set({ deleted_in_moodle_at: new Date() })
          .where(inArray(moodle_users.id_moodle_user, toMarkDeleted));
      }
    });

    const result: SyncStatusResult = {
      suspended_updated: toSuspend.length + toUnsuspend.length,
      deleted_marked: toMarkDeleted.length,
    };
    Logger.log({ ...result, links: links.length }, "MoodleAuditService:syncStatus");
    return result;
  }

  /**
   * Borra usuarios EN MOODLE (`core_user_delete_users`, irreversible) y marca
   * la lápida local. Server-authoritative en las protecciones: solo acepta IDs
   * que el propio informe considera candidatos (existen en el snapshot, sin
   * ningún curso en Moodle) y NO protegidos (gestor de la app / tutor); el
   * resto vuelve como error por fila sin abortar el lote. Coste: ~1 llamada por
   * cada 200 borrados.
   */
  async deleteFromMoodle(moodleIds: number[]): Promise<DeleteFromMoodleResult> {
    await this.ensureLoaded();
    if (!this.snapshot) {
      throw new ConflictException("No hay snapshot de Moodle: ejecuta primero el diagnóstico");
    }
    if (!this.enrolSnapshot) {
      throw new ConflictException("No hay snapshot de matrículas: descárgalo antes de borrar (evita borrar usuarios con cursos)");
    }

    // Recalcular los candidatos válidos con los mismos datos que el informe
    const report = await this.buildReport();
    const candidateByMoodleId = new Map(report.cleanupCandidates.map(c => [c.moodle.moodle_id, c]));

    const errors: DeleteFromMoodleResult["errors"] = [];
    const deletable: number[] = [];
    for (const moodleId of new Set(moodleIds)) {
      const candidate = candidateByMoodleId.get(moodleId);
      if (!candidate) {
        errors.push({
          moodle_id: moodleId,
          message: this.snapshot.moodleIds.has(moodleId)
            ? "No es candidato: tiene cursos en Moodle"
            : "No existe en el snapshot de Moodle (¿ya borrado?)",
        });
      } else if (candidate.protected) {
        errors.push({
          moodle_id: moodleId,
          message: `Protegido contra borrado: ${candidate.protected_reasons.map(r => (r === "auth-user" ? "gestor de la app" : "tutor de grupo")).join(", ")}`,
        });
      } else {
        deletable.push(moodleId);
      }
    }

    const callsBefore = this.moodleService.moodleCallCount;
    const deletedIds: number[] = [];
    const chunkSize = 200;

    // `core_user_delete_users` es atómico por lote: si un id es rechazable
    // (p.ej. un admin de Moodle no matriculado en nada, invisible para las
    // protecciones locales), Moodle rechaza el lote ENTERO sin borrar nada.
    // Bisección: el lote fallido se parte en mitades hasta aislar a los
    // culpables, que vuelven como error por fila. Coste extra ~2·log2(n)
    // llamadas por cada id conflictivo.
    const deleteBatch = async (ids: number[]): Promise<void> => {
      try {
        await this.moodleService.deleteUsers(ids);
        deletedIds.push(...ids);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (ids.length === 1) {
          errors.push({ moodle_id: ids[0], message });
          return;
        }
        Logger.warn({ chunkLength: ids.length, message }, "MoodleAuditService:deleteFromMoodle - lote rechazado, bisecando");
        const mid = Math.ceil(ids.length / 2);
        await deleteBatch(ids.slice(0, mid));
        await deleteBatch(ids.slice(mid));
      }
    };
    for (let i = 0; i < deletable.length; i += chunkSize) {
      await deleteBatch(deletable.slice(i, i + chunkSize));
    }
    const moodleCalls = this.moodleService.moodleCallCount - callsBefore;

    // Marcar lápidas locales y sacar los borrados de los snapshots en memoria
    let markedLocal = 0;
    if (deletedIds.length > 0) {
      const marked = await this.db
        .update(moodle_users)
        .set({ deleted_in_moodle_at: new Date() })
        .where(and(inArray(moodle_users.moodle_id, deletedIds), isNull(moodle_users.deleted_in_moodle_at)))
        .returning({ id_moodle_user: moodle_users.id_moodle_user });
      markedLocal = marked.length;

      const deletedSet = new Set(deletedIds);
      this.snapshot.users = this.snapshot.users.filter(u => !deletedSet.has(u.moodle_id));
      for (const id of deletedIds) this.snapshot.moodleIds.delete(id);
      // Mantener coherente la copia persistida (mismo fetchedAt: no es una descarga nueva)
      await this.persistSnapshot("users", this.snapshot.fetchedAt, this.snapshot.moodleCalls, this.snapshot.users);
    }

    const result: DeleteFromMoodleResult = { deleted: deletedIds.length, marked_local: markedLocal, errors, moodleCalls };
    Logger.log({ requested: moodleIds.length, ...result, errors: errors.length }, "MoodleAuditService:deleteFromMoodle");
    return result;
  }

  /**
   * Marca una cuenta de Moodle como intocable ("manual"): el borrado la
   * rechazará aunque sea candidata. Clave por moodle_id porque la cuenta puede
   * no tener vínculo local. Idempotente.
   */
  async protectMoodleUser(moodleId: number): Promise<{ moodle_id: number; moodle_username: string }> {
    await this.ensureLoaded();
    const snapshotUser = this.snapshot?.users.find(u => u.moodle_id === moodleId);
    if (!snapshotUser) {
      throw new NotFoundException(`La cuenta de Moodle ${moodleId} no está en el snapshot`);
    }
    await this.db
      .insert(moodle_protected_users)
      .values({ moodle_id: moodleId, moodle_username: snapshotUser.username })
      .onConflictDoNothing();
    Logger.log({ moodleId, username: snapshotUser.username }, "MoodleAuditService:protectMoodleUser");
    return { moodle_id: moodleId, moodle_username: snapshotUser.username };
  }

  /** Retira la protección manual de una cuenta de Moodle. Idempotente. */
  async unprotectMoodleUser(moodleId: number): Promise<{ moodle_id: number }> {
    await this.db.delete(moodle_protected_users).where(eq(moodle_protected_users.moodle_id, moodleId));
    Logger.log({ moodleId }, "MoodleAuditService:unprotectMoodleUser");
    return { moodle_id: moodleId };
  }

  /**
   * Corrige los `moodle_username` desactualizados copiando el username REAL del
   * snapshot (server-authoritative: el cliente solo elige QUÉ vínculos, nunca el
   * valor). `moodle_username` es UNIQUE y los desfases pueden formar cadenas o
   * intercambios (el username libre de uno lo ocupa otro vínculo desactualizado),
   * así que dentro de una transacción se renombran primero TODOS los objetivos a
   * un valor temporal (libera los usernames en disputa) y después se asigna el
   * real. Los conflictos con vínculos NO objetivo se detectan antes en memoria y
   * se devuelven como errores sin intentar el UPDATE (nada aborta la tx).
   */
  async fixUsernames(idMoodleUsers?: number[]): Promise<UsernameFixResult> {
    await this.ensureLoaded();
    if (!this.snapshot) {
      throw new ConflictException("No hay snapshot de Moodle: ejecuta primero el diagnóstico");
    }
    const realByMoodleId = new Map(this.snapshot.users.map(u => [u.moodle_id, u.username]));

    const links = await this.db
      .select({
        id_moodle_user: moodle_users.id_moodle_user,
        moodle_id: moodle_users.moodle_id,
        moodle_username: moodle_users.moodle_username,
      })
      .from(moodle_users);

    const filter = idMoodleUsers && idMoodleUsers.length > 0 ? new Set(idMoodleUsers) : null;
    const targets = links
      .map(l => ({ ...l, real: realByMoodleId.get(l.moodle_id) }))
      .filter(
        (l): l is typeof l & { real: string } =>
          l.real !== undefined && l.real !== l.moodle_username && (!filter || filter.has(l.id_moodle_user)),
      );

    const targetIds = new Set(targets.map(t => t.id_moodle_user));
    const nonTargetUsernames = new Map(
      links.filter(l => !targetIds.has(l.id_moodle_user)).map(l => [l.moodle_username, l.id_moodle_user]),
    );

    const errors: UsernameFixResult["errors"] = [];
    const doable: typeof targets = [];
    for (const t of targets) {
      const holder = nonTargetUsernames.get(t.real);
      if (holder !== undefined) {
        errors.push({
          id_moodle_user: t.id_moodle_user,
          stored_username: t.moodle_username,
          real_username: t.real,
          message: `El username real ya está en uso por el vínculo ${holder} (revisar en «Vínculos incorrectos» o «Huérfanos»)`,
        });
      } else {
        doable.push(t);
      }
    }

    if (doable.length > 0) {
      await this.db.transaction(async tx => {
        for (const t of doable) {
          await tx
            .update(moodle_users)
            .set({ moodle_username: `#tmp-username-sync#${t.id_moodle_user}` })
            .where(eq(moodle_users.id_moodle_user, t.id_moodle_user));
        }
        for (const t of doable) {
          await tx
            .update(moodle_users)
            .set({ moodle_username: t.real })
            .where(eq(moodle_users.id_moodle_user, t.id_moodle_user));
        }
      });
    }

    Logger.log({ updated: doable.length, errors: errors.length, requested: idMoodleUsers?.length ?? "all" }, "MoodleAuditService:fixUsernames");

    return { updated: doable.length, errors };
  }

  /**
   * Reasigna un vínculo incorrecto al usuario correcto por DNI SIN fusionar
   * fichas: mueve solo la cuenta de Moodle y lo que vino de ella (las
   * matrículas `user_course` con este `id_moodle_user` y las membresías
   * `user_group` de los grupos de esos cursos). El usuario mal vinculado se
   * conserva intacto en todo lo demás — es la alternativa a la fusión cuando
   * las dos fichas son personas DISTINTAS y solo el vínculo estaba mal.
   *
   * Server-authoritative: el destino se deriva del DNI del snapshot (mismo
   * matching que la clasificación), el cliente nunca lo elige. 0 llamadas a
   * Moodle.
   */
  async relink(idMoodleUser: number): Promise<RelinkResult> {
    await this.ensureLoaded();
    if (!this.snapshot) {
      throw new ConflictException("No hay snapshot de Moodle: ejecuta primero el diagnóstico");
    }
    const [link] = await this.db
      .select()
      .from(moodle_users)
      .where(eq(moodle_users.id_moodle_user, idMoodleUser))
      .limit(1);
    if (!link) throw new NotFoundException(`Vínculo moodle_users ${idMoodleUser} no encontrado`);

    const snapshotUser = this.snapshot.users.find(u => u.moodle_id === link.moodle_id);
    if (!snapshotUser) {
      throw new ConflictException(
        `La cuenta de Moodle ${link.moodle_id} no existe en el snapshot: es un huérfano, no se puede reasignar`,
      );
    }
    if (snapshotUser.dni_keys.length === 0) {
      throw new ConflictException("La cuenta de Moodle no aporta DNI: no se puede determinar el usuario correcto");
    }

    // Destino por DNI (primer dni_key que resuelva; mismo orden que la clasificación)
    const candidates = await this.db
      .select({ id_user: users.id_user, dni: users.dni })
      .from(users)
      .where(inArray(users.dni, snapshotUser.dni_keys));
    const byKey = new Map(candidates.map(c => [compactDniKey(c.dni), c.id_user]));
    let targetUserId: number | null = null;
    for (const key of snapshotUser.dni_keys) {
      const found = byKey.get(key);
      if (found !== undefined) { targetUserId = found; break; }
    }
    if (targetUserId === null) {
      throw new ConflictException("Ningún usuario de la BD tiene el DNI de esta cuenta de Moodle");
    }
    if (targetUserId === link.id_user) {
      throw new ConflictException("El vínculo ya apunta al usuario correcto por DNI");
    }
    const toUserId: number = targetUserId;

    return await this.db.transaction(async tx => {
      // 1) Matrículas que vinieron de esta cuenta → al destino (fusionando si ya la tiene)
      const courseRows = await tx
        .select()
        .from(user_course)
        .where(and(eq(user_course.id_moodle_user, idMoodleUser), ne(user_course.id_user, toUserId)));

      const courses = { moved: 0, merged: 0 };
      // curso → usuarios origen cuya matrícula se ha movido (para mover también sus grupos)
      const movedFromByCourse = new Map<number, Set<number>>();
      for (const row of courseRows) {
        const [existing] = await tx
          .select()
          .from(user_course)
          .where(and(eq(user_course.id_user, toUserId), eq(user_course.id_course, row.id_course)))
          .limit(1);
        if (existing) {
          await tx
            .update(user_course)
            .set(mergeUserCourseRow(existing, row))
            .where(and(eq(user_course.id_user, toUserId), eq(user_course.id_course, row.id_course)));
          await tx
            .delete(user_course)
            .where(and(eq(user_course.id_user, row.id_user), eq(user_course.id_course, row.id_course)));
          courses.merged++;
        } else {
          await tx
            .update(user_course)
            .set({ id_user: toUserId })
            .where(and(eq(user_course.id_user, row.id_user), eq(user_course.id_course, row.id_course)));
          courses.moved++;
        }
        if (!movedFromByCourse.has(row.id_course)) movedFromByCourse.set(row.id_course, new Set());
        movedFromByCourse.get(row.id_course)!.add(row.id_user);
      }

      // 2) Membresías de grupo de los cursos movidos (creadas por el mismo import
      //    que la matrícula mal vinculada) → al destino
      const groupCounts = { moved: 0, merged: 0 };
      const courseIds = Array.from(movedFromByCourse.keys());
      if (courseIds.length > 0) {
        const groupRows = await tx
          .select({ id_group: groups.id_group, id_course: groups.id_course })
          .from(groups)
          .where(inArray(groups.id_course, courseIds));
        for (const g of groupRows) {
          for (const fromUserId of movedFromByCourse.get(g.id_course) ?? []) {
            const [oldMembership] = await tx
              .select()
              .from(user_groups)
              .where(and(eq(user_groups.id_user, fromUserId), eq(user_groups.id_group, g.id_group)))
              .limit(1);
            if (!oldMembership) continue;
            const [targetMembership] = await tx
              .select()
              .from(user_groups)
              .where(and(eq(user_groups.id_user, toUserId), eq(user_groups.id_group, g.id_group)))
              .limit(1);
            if (targetMembership) {
              await tx
                .update(user_groups)
                .set(mergeUserGroupRow(targetMembership, oldMembership))
                .where(and(eq(user_groups.id_user, toUserId), eq(user_groups.id_group, g.id_group)));
              await tx
                .delete(user_groups)
                .where(and(eq(user_groups.id_user, fromUserId), eq(user_groups.id_group, g.id_group)));
              groupCounts.merged++;
            } else {
              await tx
                .update(user_groups)
                .set({ id_user: toUserId })
                .where(and(eq(user_groups.id_user, fromUserId), eq(user_groups.id_group, g.id_group)));
              groupCounts.moved++;
            }
          }
        }
      }

      // 3) Repuntar la cuenta de Moodle al destino, con is_main_user coherente
      //    en ambos lados: principal en el destino solo si aún no tiene una.
      const targetAccounts = await tx
        .select({ id_moodle_user: moodle_users.id_moodle_user, is_main_user: moodle_users.is_main_user })
        .from(moodle_users)
        .where(eq(moodle_users.id_user, toUserId));
      const targetHasMain = targetAccounts.some(a => a.is_main_user);
      const isMainForTarget = !targetHasMain;
      await tx
        .update(moodle_users)
        .set({ id_user: toUserId, is_main_user: isMainForTarget })
        .where(eq(moodle_users.id_moodle_user, idMoodleUser));

      // Si era la principal del origen, promover otra cuenta suya
      let promoted: number | null = null;
      if (link.is_main_user) {
        const [other] = await tx
          .select({ id_moodle_user: moodle_users.id_moodle_user })
          .from(moodle_users)
          .where(and(eq(moodle_users.id_user, link.id_user), ne(moodle_users.id_moodle_user, idMoodleUser)))
          .orderBy(moodle_users.id_moodle_user)
          .limit(1);
        if (other) {
          await tx
            .update(moodle_users)
            .set({ is_main_user: true })
            .where(eq(moodle_users.id_moodle_user, other.id_moodle_user));
          promoted = other.id_moodle_user;
        }
      }

      Logger.log(
        { idMoodleUser, moodleId: link.moodle_id, fromUser: link.id_user, toUser: toUserId, courses, groups: groupCounts, promoted },
        "MoodleAuditService:relink",
      );

      return {
        id_moodle_user: idMoodleUser,
        moodle_id: link.moodle_id,
        from_user: link.id_user,
        to_user: toUserId,
        courses,
        groups: groupCounts,
        promoted_id_moodle_user: promoted,
        is_main_for_target: isMainForTarget,
      };
    });
  }

  /**
   * Elimina un vínculo huérfano (cuenta que ya no existe en Moodle): conserva
   * las matrículas (solo desconecta `user_course.id_moodle_user`), borra los
   * vínculos con token y la fila de `moodle_users`, y promueve otra cuenta del
   * usuario a principal si la borrada lo era. Verifica contra el snapshot: los
   * `moodle_id` no se reutilizan en Moodle, así que un huérfano lo es para
   * siempre (no hace falta re-descargar antes de borrar).
   */
  async cleanupOrphan(idMoodleUser: number): Promise<OrphanCleanupResult> {
    await this.ensureLoaded();
    if (!this.snapshot) {
      throw new ConflictException("No hay snapshot de Moodle: ejecuta primero el diagnóstico");
    }
    const [link] = await this.db
      .select()
      .from(moodle_users)
      .where(eq(moodle_users.id_moodle_user, idMoodleUser))
      .limit(1);
    if (!link) throw new NotFoundException(`Vínculo moodle_users ${idMoodleUser} no encontrado`);
    if (this.snapshot.moodleIds.has(link.moodle_id)) {
      throw new ConflictException(
        `La cuenta de Moodle ${link.moodle_id} sigue existiendo según el snapshot: no es un huérfano`,
      );
    }

    return await this.db.transaction(async tx => {
      const clearedCourses = await tx
        .update(user_course)
        .set({ id_moodle_user: null })
        .where(eq(user_course.id_moodle_user, idMoodleUser))
        .returning({ id_user: user_course.id_user });

      const deletedTokenLinks = await tx
        .delete(moodle_user_auth_user)
        .where(eq(moodle_user_auth_user.id_moodle_user, idMoodleUser))
        .returning({ id: moodle_user_auth_user.id });

      await tx.delete(moodle_users).where(eq(moodle_users.id_moodle_user, idMoodleUser));

      // Si la cuenta borrada era la principal, promover otra del mismo usuario
      let promoted: number | null = null;
      if (link.is_main_user) {
        const [other] = await tx
          .select({ id_moodle_user: moodle_users.id_moodle_user })
          .from(moodle_users)
          .where(and(eq(moodle_users.id_user, link.id_user), ne(moodle_users.id_moodle_user, idMoodleUser)))
          .orderBy(moodle_users.id_moodle_user)
          .limit(1);
        if (other) {
          await tx
            .update(moodle_users)
            .set({ is_main_user: true })
            .where(eq(moodle_users.id_moodle_user, other.id_moodle_user));
          promoted = other.id_moodle_user;
        }
      }

      Logger.log(
        { idMoodleUser, moodleId: link.moodle_id, idUser: link.id_user, cleared: clearedCourses.length, tokens: deletedTokenLinks.length, promoted },
        "MoodleAuditService:cleanupOrphan",
      );

      return {
        id_moodle_user: idMoodleUser,
        moodle_id: link.moodle_id,
        cleared_user_courses: clearedCourses.length,
        deleted_token_links: deletedTokenLinks.length,
        promoted_id_moodle_user: promoted,
      };
    });
  }
}
