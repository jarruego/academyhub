import { ConflictException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";
import { users, moodle_users, user_course, user_groups, groups, moodle_user_auth_user } from "src/database/schema";
import { eq, isNotNull, ne, and, sql, inArray } from "drizzle-orm";
import { MoodleService } from "src/api/moodle/moodle.service";
import { compactDniKey } from "src/api/moodle/moodle-user-matching.util";
import { mergeUserCourseRow, mergeUserGroupRow } from "src/api/user-merge/user-merge.util";
import {
  AuditLinkRow,
  AuditMoodleUser,
  AuditUserRef,
  classifyMoodleLinks,
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
  totals: {
    ok: number;
    incorrectLinks: number;
    unverifiable: number;
    orphans: number;
    noCourses: number;
    unlinked: number;
    usernameMismatches: number;
  };
}

export interface UsernameFixResult {
  updated: number;
  errors: Array<{ id_moodle_user: number; stored_username: string; real_username: string; message: string }>;
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
 * Auditoría de vínculos Moodle ↔ BD local. El snapshot de usuarios de Moodle se
 * descarga UNA vez (`refreshSnapshot`, ~1 + N/200 llamadas) y se cachea en
 * memoria del proceso; el informe y las acciones de limpieza trabajan solo
 * contra la BD local (0 llamadas). El snapshot se pierde al reiniciar el
 * servidor (aceptado: re-descargar es barato y explícito desde la UI).
 */
@Injectable()
export class MoodleAuditService {
  private snapshot: {
    fetchedAt: Date;
    users: AuditMoodleUser[];
    moodleIds: Set<number>;
    moodleCalls: number;
  } | null = null;

  constructor(
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService,
    private readonly moodleService: MoodleService,
  ) {}

  private get db() {
    return this.databaseService.db;
  }

  /** Descarga el snapshot de Moodle (la única operación con llamadas) y devuelve el informe. */
  async refreshSnapshot(): Promise<MoodleAuditReport> {
    const callsBefore = this.moodleService.moodleCallCount;
    const moodleUsers = await this.moodleService.getAllUsers();
    const auditUsers = moodleUsers.map(toAuditMoodleUser);
    this.snapshot = {
      fetchedAt: new Date(),
      users: auditUsers,
      moodleIds: new Set(auditUsers.map(u => u.moodle_id)),
      moodleCalls: this.moodleService.moodleCallCount - callsBefore,
    };
    Logger.log(
      { snapshotSize: auditUsers.length, moodleCalls: this.snapshot.moodleCalls },
      "MoodleAuditService:refreshSnapshot",
    );
    return this.buildReport();
  }

  /** Informe recalculado contra la BD local con el snapshot cacheado (0 llamadas a Moodle). */
  async getReport(): Promise<MoodleAuditReport> {
    if (!this.snapshot) {
      return {
        hasSnapshot: false,
        fetchedAt: null,
        snapshotSize: 0,
        moodleCallsLastFetch: null,
        totals: { ok: 0, incorrectLinks: 0, unverifiable: 0, orphans: 0, noCourses: 0, unlinked: 0, usernameMismatches: 0 },
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

  private async buildReport(): Promise<MoodleAuditReport> {
    const snapshot = this.snapshot!;

    // Todo en bulk: nada de consultas por usuario.
    const [linkRows, ucRefRows, tokenRefRows, userRows, courseCountRows, groupCountRows] = await Promise.all([
      this.db
        .select({
          id_moodle_user: moodle_users.id_moodle_user,
          id_user: moodle_users.id_user,
          moodle_id: moodle_users.moodle_id,
          moodle_username: moodle_users.moodle_username,
          is_main_user: moodle_users.is_main_user,
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

    return {
      hasSnapshot: true,
      fetchedAt: snapshot.fetchedAt.toISOString(),
      snapshotSize: snapshot.users.length,
      moodleCallsLastFetch: snapshot.moodleCalls,
      totals: {
        ok: classification.ok_count,
        incorrectLinks: classification.incorrectLinks.length,
        unverifiable: classification.unverifiable.length,
        orphans: classification.orphans.length,
        noCourses: classification.noCourses.length,
        unlinked: classification.unlinked.length,
        usernameMismatches: classification.usernameMismatches.length,
      },
      ...classification,
    };
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
