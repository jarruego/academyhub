import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";
import {
  users,
  user_center,
  user_course,
  user_groups,
  user_preinscription,
  moodle_users,
  import_decisions,
} from "src/database/schema";
import { and, eq, sql } from "drizzle-orm";
import {
  MERGEABLE_FIELDS,
  mergePreinscriptionRow,
  mergeUserCourseRow,
  mergeUserGroupRow,
  normalizeName,
} from "./user-merge.util";
import { canonicalNss, isValidNss, pickValidNss } from "src/utils/nss.util";

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
  // false si los nombres normalizados no coinciden entre todos (posible falso positivo)
  nameMatch: boolean;
}

@Injectable()
export class UserMergeService {
  constructor(
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService,
  ) {}

  private get db() {
    return this.databaseService.db;
  }

  /**
   * Grupos de usuarios duplicados detectados por NSS normalizado (mismo NSS sin
   * ceros a la izquierda ni separadores). Solo grupos con 2+ miembros.
   */
  async getCandidates(): Promise<MergeCandidateGroup[]> {
    const result = await this.db.execute(sql`
      WITH norm AS (
        SELECT
          id_user, name, first_surname, second_surname, dni, nss, email,
          regexp_replace(regexp_replace(coalesce(nss, ''), '\\D', '', 'g'), '^0+', '') AS nss_norm
        FROM ${users}
      ),
      dups AS (
        SELECT nss_norm FROM norm WHERE nss_norm <> '' GROUP BY nss_norm HAVING count(*) > 1
      )
      SELECT
        n.id_user, n.name, n.first_surname, n.second_surname, n.dni, n.nss, n.email, n.nss_norm,
        (SELECT count(*) FROM ${user_course} uc WHERE uc.id_user = n.id_user) AS courses_count,
        (SELECT count(*) FROM ${user_groups} ug WHERE ug.id_user = n.id_user) AS groups_count,
        (SELECT count(*) FROM ${user_center} ucn WHERE ucn.id_user = n.id_user) AS centers_count,
        (SELECT count(*) FROM ${user_preinscription} up WHERE up.id_user = n.id_user) AS preinscriptions_count,
        (SELECT count(*) FROM ${moodle_users} mu WHERE mu.id_user = n.id_user) AS moodle_count
      FROM norm n
      JOIN dups d ON d.nss_norm = n.nss_norm
      ORDER BY n.nss_norm, n.id_user
    `);

    const rows = (result as unknown as { rows: any[] }).rows ?? [];
    const groups = new Map<string, MergeCandidateMember[]>();
    for (const r of rows) {
      const member: MergeCandidateMember = {
        id_user: Number(r.id_user),
        name: r.name,
        first_surname: r.first_surname,
        second_surname: r.second_surname,
        dni: r.dni,
        nss: r.nss,
        email: r.email,
        courses_count: Number(r.courses_count),
        groups_count: Number(r.groups_count),
        centers_count: Number(r.centers_count),
        preinscriptions_count: Number(r.preinscriptions_count),
        moodle_count: Number(r.moodle_count),
      };
      const key = String(r.nss_norm);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(member);
    }

    return Array.from(groups.entries()).map(([nss_norm, members]) => {
      const names = new Set(members.map(m => normalizeName(m.name, m.first_surname, m.second_surname)));
      return { nss_norm, members, nameMatch: names.size === 1 };
    });
  }

  /** Carga una ficha o lanza NotFound. */
  private async loadUser(id: number) {
    const [row] = await this.db.select().from(users).where(eq(users.id_user, id)).limit(1);
    if (!row) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return row;
  }

  /**
   * Previsualización: diff escalar campo a campo, colisiones de relación y aviso
   * de doble cuenta Moodle. No modifica nada.
   */
  async preview(winnerId: number, loserId: number) {
    if (winnerId === loserId) throw new BadRequestException("El ganador y el perdedor no pueden ser el mismo usuario");
    const winner = await this.loadUser(winnerId);
    const loser = await this.loadUser(loserId);

    const isEmpty = (v: unknown) => v === null || v === undefined || v === "";
    // El NSS NO es elegible campo a campo: se resuelve automáticamente conservando
    // el que pasa el dígito de control (ver resolvedNss más abajo).
    const fields = MERGEABLE_FIELDS.filter(f => f !== "nss").map(field => {
      const winnerValue = (winner as any)[field] ?? null;
      const loserValue = (loser as any)[field] ?? null;
      const differ = String(winnerValue ?? "") !== String(loserValue ?? "");
      return { field, winnerValue, loserValue, differ, winnerEmpty: isEmpty(winnerValue) };
    });

    const resolvedNssValue = pickValidNss(winner.nss, loser.nss);
    const resolvedNss = {
      winnerNss: winner.nss ?? null,
      loserNss: loser.nss ?? null,
      value: resolvedNssValue,
      // de cuál procede el valor conservado (para mostrarlo en la UI)
      from: resolvedNssValue == null ? null
        : canonicalNss(winner.nss) === resolvedNssValue ? "winner"
        : canonicalNss(loser.nss) === resolvedNssValue ? "loser" : "winner",
      valid: isValidNss(resolvedNssValue),
    };

    const sharedCourses = await this.sharedKeys(user_course, "id_course", winnerId, loserId);
    const sharedGroups = await this.sharedKeys(user_groups, "id_group", winnerId, loserId);
    const sharedCenters = await this.sharedKeys(user_center, "id_center", winnerId, loserId);
    const sharedPreinscriptions = await this.sharedKeys(user_preinscription, "id_course", winnerId, loserId);

    const winnerMoodle = await this.db.select().from(moodle_users).where(eq(moodle_users.id_user, winnerId));
    const loserMoodle = await this.db.select().from(moodle_users).where(eq(moodle_users.id_user, loserId));

    return {
      winner: { id_user: winner.id_user, name: winner.name, first_surname: winner.first_surname, second_surname: winner.second_surname, dni: winner.dni, nss: winner.nss },
      loser: { id_user: loser.id_user, name: loser.name, first_surname: loser.first_surname, second_surname: loser.second_surname, dni: loser.dni, nss: loser.nss },
      fields,
      resolvedNss,
      collisions: {
        courses: sharedCourses.length,
        groups: sharedGroups.length,
        centers: sharedCenters.length,
        preinscriptions: sharedPreinscriptions.length,
      },
      dualMoodle: winnerMoodle.length > 0 && loserMoodle.length > 0,
    };
  }

  /** Devuelve las claves "id_other" que tienen en común ganador y perdedor en una tabla de enlace. */
  private async sharedKeys(table: any, otherCol: string, winnerId: number, loserId: number): Promise<number[]> {
    const rows = await this.db.execute(sql`
      SELECT w.${sql.raw(otherCol)} AS k
      FROM ${table} w
      JOIN ${table} l ON w.${sql.raw(otherCol)} = l.${sql.raw(otherCol)}
      WHERE w.id_user = ${winnerId} AND l.id_user = ${loserId}
    `);
    return ((rows as unknown as { rows: any[] }).rows ?? []).map(r => Number(r.k));
  }

  /**
   * Fusiona la ficha `loserId` dentro de `winnerId`: reasigna todas las
   * relaciones, borra al perdedor y aplica los campos escalares elegidos.
   * Todo en una transacción.
   */
  async merge(winnerId: number, loserId: number, fieldsFromLoser: string[] = []) {
    if (winnerId === loserId) throw new BadRequestException("El ganador y el perdedor no pueden ser el mismo usuario");

    return this.db.transaction(async (tx) => {
      const [winner] = await tx.select().from(users).where(eq(users.id_user, winnerId)).limit(1);
      if (!winner) throw new NotFoundException(`Usuario ganador ${winnerId} no encontrado`);
      const [loser] = await tx.select().from(users).where(eq(users.id_user, loserId)).limit(1);
      if (!loser) throw new NotFoundException(`Usuario perdedor ${loserId} no encontrado`);

      const reassigned: Record<string, { moved: number; merged: number }> = {};

      // --- moodle_users (sin PK compuesta; detectar doble cuenta) ---
      const winnerMoodleBefore = await tx.select().from(moodle_users).where(eq(moodle_users.id_user, winnerId));
      const loserMoodle = await tx.select().from(moodle_users).where(eq(moodle_users.id_user, loserId));
      const dualMoodle = winnerMoodleBefore.length > 0 && loserMoodle.length > 0;
      if (loserMoodle.length > 0) {
        await tx.update(moodle_users).set({ id_user: winnerId }).where(eq(moodle_users.id_user, loserId));
        // Garantizar un solo is_main_user: si el ganador ya tenía cuenta principal,
        // las que vienen del perdedor dejan de serlo.
        if (winnerMoodleBefore.some(m => m.is_main_user)) {
          for (const lm of loserMoodle) {
            await tx.update(moodle_users).set({ is_main_user: false }).where(eq(moodle_users.id_moodle_user, lm.id_moodle_user));
          }
        }
      }
      reassigned.moodle_users = { moved: loserMoodle.length, merged: 0 };

      // --- tablas de enlace con PK compuesta (id_user, id_other) ---
      reassigned.user_course = await this.reassignLinkTable(tx, user_course, "id_course", winnerId, loserId, mergeUserCourseRow);
      reassigned.user_group = await this.reassignLinkTable(tx, user_groups, "id_group", winnerId, loserId, mergeUserGroupRow);
      reassigned.user_preinscription = await this.reassignLinkTable(tx, user_preinscription, "id_course", winnerId, loserId, mergePreinscriptionRow);
      reassigned.user_center = await this.reassignLinkTable(tx, user_center, "id_center", winnerId, loserId, () => ({}));

      // Recalcular centro principal del ganador (un solo is_main_center).
      await this.recalcMainCenter(tx, winnerId);

      // --- import_decisions: repuntar al ganador (coherente con el borrado de usuarios) ---
      await tx.update(import_decisions).set({ selected_user_id: winnerId }).where(eq(import_decisions.selected_user_id, loserId));

      // --- borrar al perdedor (ya sin FKs entrantes; libera dni/nss UNIQUE) ---
      await tx.delete(users).where(eq(users.id_user, loserId));

      // --- aplicar campos elegidos del perdedor (whitelist, NSS excluido) ---
      const allowed = (fieldsFromLoser ?? []).filter(
        f => f !== "nss" && (MERGEABLE_FIELDS as readonly string[]).includes(f),
      );
      const patch: Record<string, unknown> = {};
      for (const f of allowed) patch[f] = (loser as any)[f];

      // --- NSS: conservar siempre el válido (dígito de control), sea de quien
      //     sea, en forma canónica de 12 dígitos. No depende del selector. ---
      const resolvedNss = pickValidNss(winner.nss, loser.nss);
      if (resolvedNss !== (winner.nss ?? null)) {
        patch.nss = resolvedNss;
      }

      if (Object.keys(patch).length > 0) {
        patch.updatedAt = new Date();
        await tx.update(users).set(patch).where(eq(users.id_user, winnerId));
      }

      return { winnerId, loserId, reassigned, dualMoodle, fieldsApplied: allowed, resolvedNss };
    });
  }

  /**
   * Reasigna las filas del perdedor al ganador en una tabla de enlace con PK
   * (id_user, otherCol). Si el ganador ya tiene la misma clave, fusiona ambas
   * filas (vía `mergeFn`) y borra la del perdedor; si no, mueve la fila.
   */
  private async reassignLinkTable(
    tx: any,
    table: any,
    otherCol: string,
    winnerId: number,
    loserId: number,
    mergeFn: (w: any, l: any) => Record<string, unknown>,
  ): Promise<{ moved: number; merged: number }> {
    const col = table[otherCol];
    const loserRows = await tx.select().from(table).where(eq(table.id_user, loserId));
    let moved = 0;
    let merged = 0;
    for (const lr of loserRows) {
      const keyVal = (lr as any)[otherCol];
      const [wr] = await tx
        .select()
        .from(table)
        .where(and(eq(table.id_user, winnerId), eq(col, keyVal)))
        .limit(1);
      if (wr) {
        const mergedValues = mergeFn(wr, lr);
        if (Object.keys(mergedValues).length > 0) {
          await tx.update(table).set(mergedValues).where(and(eq(table.id_user, winnerId), eq(col, keyVal)));
        }
        await tx.delete(table).where(and(eq(table.id_user, loserId), eq(col, keyVal)));
        merged++;
      } else {
        await tx.update(table).set({ id_user: winnerId }).where(and(eq(table.id_user, loserId), eq(col, keyVal)));
        moved++;
      }
    }
    return { moved, merged };
  }

  /**
   * Tras fusionar centros, deja exactamente un is_main_center en el ganador:
   * prefiere un centro activo (end_date NULL) con start_date más antiguo; si no,
   * el de end_date más reciente. Si ya hay justo un principal, no toca nada.
   */
  private async recalcMainCenter(tx: any, winnerId: number) {
    const rows = await tx.select().from(user_center).where(eq(user_center.id_user, winnerId));
    if (rows.length === 0) return;
    const mains = rows.filter((r: any) => r.is_main_center);
    if (mains.length === 1) return;

    const score = (r: any) => {
      const start = r.start_date ? new Date(r.start_date).getTime() : Number.MAX_SAFE_INTEGER;
      const end = r.end_date ? new Date(r.end_date).getTime() : null;
      return { active: end === null, start, end: end ?? -1 };
    };
    const sorted = [...rows].sort((a: any, b: any) => {
      const sa = score(a), sb = score(b);
      if (sa.active !== sb.active) return sa.active ? -1 : 1; // activos primero
      if (sa.active) return sa.start - sb.start;              // activo: start más antiguo
      return sb.end - sa.end;                                 // cerrado: end más reciente
    });
    const chosen = sorted[0];
    for (const r of rows) {
      const shouldBeMain = r.id_center === chosen.id_center;
      if (!!r.is_main_center !== shouldBeMain) {
        await tx.update(user_center).set({ is_main_center: shouldBeMain }).where(and(eq(user_center.id_user, winnerId), eq(user_center.id_center, r.id_center)));
      }
    }
  }
}
