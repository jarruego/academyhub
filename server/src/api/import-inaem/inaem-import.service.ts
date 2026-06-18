import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { DatabaseService } from "src/database/database.service";
import { DATABASE_PROVIDER } from "src/database/database.module";
import {
  courses,
  groups,
  users,
  user_groups,
  user_course,
  import_decisions,
  failed_user_imports,
} from "src/database/schema";
import { ImportType, ImportJobStatus } from "src/database/schema/tables/import.table";
import { JobService } from "../import-sage/job.service";
import { GroupService } from "../group/group.service";
import { UserPreinscriptionRepository } from "src/database/repository/preinscription/user-preinscription.repository";
import { UserGroupRepository } from "src/database/repository/group/user-group.repository";
import { CourseModality } from "src/types/course/course-modality.enum";
import { CourseOrigin } from "src/types/course/course-origin.enum";
import { CourseFunding } from "src/types/course/course-funding.enum";
import { PreinscriptionStatus } from "src/types/preinscription/preinscription-status.enum";
import { parseInaemFile } from "./inaem-file.parser";
import { ParsedTable } from "./inaem-html-table.parser";
import { cleanText, parseInaemDate, parseSiNo, sanitizeDni, upsertObservationBlock } from "./inaem-normalize.util";
import {
  mapRowToUserFields,
  buildObservationsForRow,
  computeUserMerge,
  IncomingUserFields,
} from "./inaem-mapping.util";
import { ACCIONES, ALUMNOS, COMMON, PREINSCRIPCIONES } from "./inaem-column-map";

export interface InaemImportFiles {
  acciones?: Buffer;
  alumnos?: Buffer;
  preinscripciones?: Buffer;
}

export interface InaemImportOptions {
  /** Crear acciones formativas (curso provisional) cuando llega un expediente sin curso. */
  createMissingCourses: boolean;
}

interface InaemSummary {
  coursesCreated: number;
  coursesUpdated: number;
  usersCreated: number;
  usersUpdated: number;
  enrollments: number;
  preinscriptions: number;
  conflicts: number;
  failed: number;
}

type CourseRow = typeof courses.$inferSelect;

interface ImportCtx {
  usersByDni: Map<string, any>;
  coursesByFile: Map<string, CourseRow>;
  groupByCourse: Map<number, number>; // id_course -> id_group
  options: InaemImportOptions;
  summary: InaemSummary;
}

@Injectable()
export class InaemImportService {
  private readonly logger = new Logger(InaemImportService.name);

  constructor(
    @Inject(DATABASE_PROVIDER) private readonly dbService: DatabaseService,
    private readonly jobService: JobService,
    private readonly preinscriptionRepo: UserPreinscriptionRepository,
    private readonly groupService: GroupService,
    private readonly userGroupRepo: UserGroupRepository,
  ) {}

  private get db() {
    return this.dbService.db;
  }

  /** Inicia un import INAEM en segundo plano y devuelve el jobId. */
  async startImport(files: InaemImportFiles, options: InaemImportOptions): Promise<string> {
    if (!files.acciones && !files.alumnos && !files.preinscripciones) {
      throw new Error("No se ha proporcionado ningún fichero");
    }
    const jobId = await this.jobService.createJob(ImportType.INAEM);
    // Fire-and-forget: el progreso se consulta vía job-status.
    void this.process(jobId, files, options).catch((err) => {
      this.logger.error(`Import INAEM ${jobId} falló: ${err?.message || err}`);
      void this.jobService.failJob(jobId, String(err?.message || err));
    });
    return jobId;
  }

  private async process(jobId: string, files: InaemImportFiles, options: InaemImportOptions) {
    await this.jobService.updateJobStatus(jobId, ImportJobStatus.PROCESSING);

    const parsed = {
      acciones: files.acciones ? await parseInaemFile(files.acciones) : undefined,
      alumnos: files.alumnos ? await parseInaemFile(files.alumnos) : undefined,
      preinscripciones: files.preinscripciones ? await parseInaemFile(files.preinscripciones) : undefined,
    };

    const total =
      (parsed.acciones?.rows.length || 0) +
      (parsed.alumnos?.rows.length || 0) +
      (parsed.preinscripciones?.rows.length || 0);
    await this.jobService.updateJobProgress(jobId, total, 0);

    const ctx: ImportCtx = {
      usersByDni: await this.preloadUsers(),
      coursesByFile: await this.preloadCourses(),
      groupByCourse: new Map(),
      options,
      summary: {
        coursesCreated: 0,
        coursesUpdated: 0,
        usersCreated: 0,
        usersUpdated: 0,
        enrollments: 0,
        preinscriptions: 0,
        conflicts: 0,
        failed: 0,
      },
    };

    let processed = 0;
    const tick = async () => {
      processed++;
      if (processed % 25 === 0) await this.jobService.updateJobProgress(jobId, total, processed);
    };

    // Orden: Acciones -> Preinscripciones -> Alumnos.
    // Preinscripciones crea la preinscripción (estado PREINSCRITO + prioritaria) y
    // Alumnos, al matricular, la promueve a MATRICULADO (markEnrolled no degrada estado).
    if (parsed.acciones) await this.importAcciones(parsed.acciones, ctx, tick);
    if (parsed.preinscripciones) await this.importPreinscripciones(parsed.preinscripciones, ctx, tick);
    if (parsed.alumnos) await this.importAlumnos(parsed.alumnos, ctx, tick);

    await this.jobService.updateJobProgress(jobId, total, processed);
    await this.jobService.completeJob(jobId, ctx.summary as any);
  }

  // ---------- Preloads ----------

  private async preloadUsers(): Promise<Map<string, any>> {
    const rows = await this.db.select().from(users);
    const map = new Map<string, any>();
    for (const u of rows) {
      const key = sanitizeDni(u.dni ?? "");
      if (key) map.set(key, u);
    }
    return map;
  }

  private async preloadCourses(): Promise<Map<string, CourseRow>> {
    const rows = await this.db.select().from(courses).where(isNotNull(courses.file_number));
    const map = new Map<string, CourseRow>();
    for (const c of rows) if (c.file_number) map.set(c.file_number.trim(), c);
    return map;
  }

  // ---------- Acciones ----------

  private async importAcciones(table: ParsedTable, ctx: ImportCtx, tick: () => Promise<void>) {
    const estadoHeader = table.headers[0]; // 1ª columna sin cabecera (Estado)
    for (const row of table.rows) {
      try {
        const fileNumber = cleanText(row[ACCIONES.FILE_NUMBER]);
        if (!fileNumber) {
          await this.fail(row, fileNumber, "Acción sin nº de expediente");
          ctx.summary.failed++;
          continue;
        }
        const courseName = cleanText(row[ACCIONES.COURSE_NAME]) ?? fileNumber;
        const start = parseInaemDate(row[ACCIONES.START]);
        const end = parseInaemDate(row[ACCIONES.END]);
        const hoursRaw = cleanText(row[ACCIONES.HOURS]);
        const hours = hoursRaw && /^\d+$/.test(hoursRaw) ? parseInt(hoursRaw, 10) : undefined;

        const existing = ctx.coursesByFile.get(fileNumber);
        if (existing) {
          const update: Record<string, unknown> = {};
          // Curso provisional autocreado -> completar con datos reales.
          if (existing.is_provisional) {
            update.course_name = courseName;
            update.is_provisional = false;
          }
          if (!existing.origin) update.origin = CourseOrigin.INAEM;
          // Los cursos INAEM son subvención pública (fill-gaps: no pisa un valor manual).
          if (!existing.funding) update.funding = CourseFunding.PUBLICA;
          if (!existing.start_date && start) update.start_date = start;
          if (!existing.end_date && end) update.end_date = end;
          if (!existing.hours && hours !== undefined) update.hours = hours;
          if (Object.keys(update).length) {
            await this.db.update(courses).set(update).where(eq(courses.id_course, existing.id_course));
            ctx.coursesByFile.set(fileNumber, { ...existing, ...(update as any) });
            ctx.summary.coursesUpdated++;
          }
          // Propaga las fechas reales a los grupos del curso que las tengan vacías
          // (caso típico: grupo creado sin fechas en un curso provisional, que
          // ahora Acciones completa). Fill-gaps: no pisa fechas ya existentes.
          if (update.start_date) {
            await this.db
              .update(groups)
              .set({ start_date: update.start_date as Date })
              .where(and(eq(groups.id_course, existing.id_course), isNull(groups.start_date)));
          }
          if (update.end_date) {
            await this.db
              .update(groups)
              .set({ end_date: update.end_date as Date })
              .where(and(eq(groups.id_course, existing.id_course), isNull(groups.end_date)));
          }
        } else {
          const inserted = await this.db
            .insert(courses)
            .values({
              course_name: courseName,
              short_name: fileNumber,
              file_number: fileNumber,
              origin: CourseOrigin.INAEM,
              funding: CourseFunding.PUBLICA,
              modality: CourseModality.PRESENTIAL,
              is_provisional: false,
              start_date: start ?? null,
              end_date: end ?? null,
              hours: hours ?? null,
            })
            .returning();
          const course = inserted[0] as CourseRow;
          ctx.coursesByFile.set(fileNumber, course);
          await this.ensureGroup(ctx, course);
          ctx.summary.coursesCreated++;
        }
      } catch (e: any) {
        await this.fail(row, undefined, `Error en acción: ${e?.message || e}`);
        ctx.summary.failed++;
      } finally {
        await tick();
      }
    }
    void estadoHeader; // Estado/Gestor no se persisten (sin columna; diferido).
  }

  // ---------- Alumnos ----------

  private async importAlumnos(table: ParsedTable, ctx: ImportCtx, tick: () => Promise<void>) {
    // Rol 'student' (se crea si no existe) para rellenar matrículas existentes sin rol.
    const studentRoleId = await this.userGroupRepo.findOrCreateRoleByShortname("student");
    for (const row of table.rows) {
      try {
        const fileNumber = cleanText(row[COMMON.FILE_NUMBER]);
        const incoming = mapRowToUserFields(row);
        if (!incoming.dni) {
          await this.fail(row, fileNumber, "Alumno sin DNI/NIE");
          ctx.summary.failed++;
          continue;
        }
        const course = await this.ensureCourse(ctx, fileNumber);
        if (!course) {
          await this.fail(row, fileNumber, "Acción formativa inexistente (creación desactivada)");
          ctx.summary.failed++;
          continue;
        }
        const userId = await this.upsertUser(ctx, incoming, fileNumber!, row, "inaem-alumnos");
        const finalized = parseSiNo(row[ALUMNOS.FINALIZED]);

        // ¿Ya está matriculado en algún grupo de este curso (p.ej. a mano)?
        const existingGroups = await this.db
          .select({ id_group: user_groups.id_group, id_role: user_groups.id_role })
          .from(user_groups)
          .innerJoin(groups, eq(user_groups.id_group, groups.id_group))
          .where(and(eq(user_groups.id_user, userId), eq(groups.id_course, course.id_course)));

        if (existingGroups.length === 0) {
          // No matriculado: matrícula canónica (crea user_course + user_group + rol student).
          const idGroup = await this.ensureGroup(ctx, course);
          await this.groupService.addUserToGroup({ id_group: idGroup, id_user: userId, allowWithoutCenter: true });
          await this.db
            .update(user_groups)
            .set({ finalized })
            .where(and(eq(user_groups.id_user, userId), eq(user_groups.id_group, idGroup)));
        } else {
          // Ya matriculado a mano: se respeta su grupo. Se marca FINALIZADO y, en
          // fill-gaps, se rellena el rol si estaba vacío (sin pisar tutores u otros
          // roles explícitos). Los datos del usuario y observaciones ya se han
          // rellenado arriba en upsertUser (fill-gaps).
          await this.db
            .insert(user_course)
            .values({ id_user: userId, id_course: course.id_course, enrollment_date: new Date(), completion_percentage: "0", time_spent: 0 })
            .onConflictDoNothing();
          for (const g of existingGroups) {
            const set: { finalized: boolean; id_role?: number } = { finalized };
            if (g.id_role == null && studentRoleId !== undefined) set.id_role = studentRoleId;
            await this.db
              .update(user_groups)
              .set(set)
              .where(and(eq(user_groups.id_user, userId), eq(user_groups.id_group, g.id_group)));
          }
        }
        ctx.summary.enrollments++;

        await this.preinscriptionRepo.markEnrolled(userId, course.id_course);
      } catch (e: any) {
        await this.fail(row, undefined, `Error en alumno: ${e?.message || e}`);
        ctx.summary.failed++;
      } finally {
        await tick();
      }
    }
  }

  // ---------- Preinscripciones ----------

  private async importPreinscripciones(table: ParsedTable, ctx: ImportCtx, tick: () => Promise<void>) {
    for (const row of table.rows) {
      try {
        const fileNumber = cleanText(row[COMMON.FILE_NUMBER]);
        const incoming = mapRowToUserFields(row);
        if (!incoming.dni) {
          await this.fail(row, fileNumber, "Preinscrito sin DNI/NIE");
          ctx.summary.failed++;
          continue;
        }
        const course = await this.ensureCourse(ctx, fileNumber);
        if (!course) {
          await this.fail(row, fileNumber, "Acción formativa inexistente (creación desactivada)");
          ctx.summary.failed++;
          continue;
        }
        const userId = await this.upsertUser(ctx, incoming, fileNumber!, row, "inaem-preinscripciones");
        await this.preinscriptionRepo.upsert({
          id_user: userId,
          id_course: course.id_course,
          prioritaria: parseSiNo(row[PREINSCRIPCIONES.PRIORITY]),
          status: PreinscriptionStatus.PREINSCRITO,
        });
        ctx.summary.preinscriptions++;
      } catch (e: any) {
        await this.fail(row, undefined, `Error en preinscripción: ${e?.message || e}`);
        ctx.summary.failed++;
      } finally {
        await tick();
      }
    }
  }

  // ---------- Helpers ----------

  /** Busca el curso por expediente; si no existe y está permitido, crea uno provisional. */
  private async ensureCourse(ctx: ImportCtx, fileNumber?: string): Promise<CourseRow | null> {
    if (!fileNumber) return null;
    const existing = ctx.coursesByFile.get(fileNumber);
    if (existing) {
      // fill-gaps de origen/financiación: si el curso casado no los tiene, márcalos
      // INAEM/PUBLICA (nunca sobreescribe valores elegidos a mano). Consistente con
      // importAcciones.
      const patch: Record<string, unknown> = {};
      if (!existing.origin) patch.origin = CourseOrigin.INAEM;
      if (!existing.funding) patch.funding = CourseFunding.PUBLICA;
      if (Object.keys(patch).length) {
        await this.db
          .update(courses)
          .set(patch)
          .where(eq(courses.id_course, existing.id_course));
        const updated = { ...existing, ...(patch as any) } as CourseRow;
        ctx.coursesByFile.set(fileNumber, updated);
        return updated;
      }
      return existing;
    }
    if (!ctx.options.createMissingCourses) return null;
    const inserted = await this.db
      .insert(courses)
      .values({
        course_name: fileNumber,
        short_name: fileNumber,
        file_number: fileNumber,
        origin: CourseOrigin.INAEM,
        funding: CourseFunding.PUBLICA,
        modality: CourseModality.PRESENTIAL,
        is_provisional: true,
      })
      .returning();
    const course = inserted[0] as CourseRow;
    ctx.coursesByFile.set(fileNumber, course);
    await this.ensureGroup(ctx, course);
    ctx.summary.coursesCreated++;
    return course;
  }

  /** Devuelve el grupo del curso (el primero); si no tiene, crea uno. */
  private async ensureGroup(ctx: ImportCtx, course: CourseRow): Promise<number> {
    const cached = ctx.groupByCourse.get(course.id_course);
    if (cached) return cached;
    const found = await this.db
      .select({ id_group: groups.id_group })
      .from(groups)
      .where(eq(groups.id_course, course.id_course))
      .limit(1);
    if (found[0]) {
      ctx.groupByCourse.set(course.id_course, found[0].id_group);
      return found[0].id_group;
    }
    const inserted = await this.db
      .insert(groups)
      .values({
        group_name: course.course_name,
        id_course: course.id_course,
        start_date: course.start_date,
        end_date: course.end_date,
      })
      .returning({ id_group: groups.id_group });
    const idGroup = inserted[0].id_group;
    ctx.groupByCourse.set(course.id_course, idGroup);
    return idGroup;
  }

  /**
   * Crea o actualiza (fill-gaps) el usuario por DNI sanitizado. Registra conflictos
   * como decisión manual y vuelca el bloque de observaciones del expediente.
   * Devuelve el id_user.
   */
  private async upsertUser(
    ctx: ImportCtx,
    incoming: IncomingUserFields,
    fileNumber: string,
    row: Record<string, string>,
    source: string,
  ): Promise<number> {
    const obsBlock = buildObservationsForRow(fileNumber, row);
    const existing = ctx.usersByDni.get(incoming.dni);

    if (existing) {
      const { update, conflicts } = computeUserMerge(existing, incoming);
      const newObs = upsertObservationBlock(existing.observations, fileNumber, obsBlock);
      if (newObs !== (existing.observations ?? "")) update.observations = newObs;

      if (conflicts.length) {
        await this.recordConflict(existing, incoming, row, conflicts, source);
        ctx.summary.conflicts++;
      }
      if (Object.keys(update).length) {
        await this.db.update(users).set(update as any).where(eq(users.id_user, existing.id_user));
        ctx.usersByDni.set(incoming.dni, { ...existing, ...update });
        ctx.summary.usersUpdated++;
      }
      return existing.id_user;
    }

    const inserted = await this.db
      .insert(users)
      .values({
        name: incoming.name ?? "(sin nombre)",
        first_surname: incoming.first_surname ?? null,
        second_surname: incoming.second_surname ?? null,
        dni: incoming.dni,
        document_type: incoming.document_type,
        email: incoming.email ?? null,
        phone: incoming.phone ?? null,
        birth_date: incoming.birth_date ?? null,
        gender: incoming.gender,
        disability: incoming.disability,
        education_level: incoming.education_level ?? null,
        address: incoming.address ?? null,
        postal_code: incoming.postal_code ?? null,
        city: incoming.city ?? null,
        province: incoming.province ?? null,
        observations: upsertObservationBlock(null, fileNumber, obsBlock) || null,
      })
      .returning({ id_user: users.id_user });
    const id_user = inserted[0].id_user;
    ctx.usersByDni.set(incoming.dni, { id_user, ...incoming, observations: obsBlock });
    ctx.summary.usersCreated++;
    return id_user;
  }

  private async recordConflict(
    existing: any,
    incoming: IncomingUserFields,
    row: Record<string, string>,
    conflicts: { field: string; dbValue: string; incomingValue: string }[],
    source: string,
  ) {
    await this.db.insert(import_decisions).values({
      import_source: source,
      dni_csv: incoming.dni?.slice(0, 20),
      name_csv: incoming.name?.slice(0, 100),
      first_surname_csv: incoming.first_surname?.slice(0, 100),
      second_surname_csv: incoming.second_surname?.slice(0, 100),
      name_db: existing.name?.slice(0, 100),
      first_surname_db: existing.first_surname?.slice(0, 100),
      second_surname_db: existing.second_surname?.slice(0, 100),
      dni_db: existing.dni?.slice(0, 20),
      email_db: existing.email?.slice(0, 255),
      similarity_score: "1.0",
      csv_row_data: row,
      change_metadata: { conflicts, id_user: existing.id_user },
      selected_user_id: existing.id_user,
      processed: false,
    });
  }

  private async fail(row: Record<string, string>, importId: string | undefined, reason: string) {
    await this.db.insert(failed_user_imports).values({
      dni: cleanText(row[COMMON.DNI])?.slice(0, 20),
      name: cleanText(row[COMMON.NAME])?.slice(0, 100),
      first_surname: cleanText(row[COMMON.SURNAME1])?.slice(0, 100),
      second_surname: cleanText(row[COMMON.SURNAME2])?.slice(0, 100),
      email: cleanText(row[COMMON.EMAIL])?.slice(0, 255),
      import_id: importId?.slice(0, 50),
      csv_row_data: row,
      failure_reason: reason,
      import_source: "inaem",
    });
  }

  // ---------- Lectura de preinscripciones ----------

  /** Preinscripciones de un usuario (para la ficha de usuario). */
  async getUserPreinscriptions(id_user: number) {
    return this.preinscriptionRepo.findByUser(id_user);
  }

  /** Preinscritos de un curso/expediente. */
  async getCoursePreinscriptions(id_course: number) {
    return this.preinscriptionRepo.findByCourse(id_course);
  }

  // ---------- Conflictos (lectura / resolución) ----------

  async getPendingConflicts() {
    const rows = await this.db
      .select()
      .from(import_decisions)
      .where(and(eq(import_decisions.processed, false), isNotNull(import_decisions.selected_user_id)));
    return rows.filter((r) => r.import_source?.startsWith("inaem-"));
  }

  /**
   * Resuelve un conflicto de sobrescritura.
   * - 'overwrite': aplica los valores entrantes a los campos en conflicto.
   * - 'keep': no cambia nada (deja el fill-gaps ya aplicado).
   */
  async resolveConflict(decisionId: number, action: "overwrite" | "keep") {
    const found = await this.db
      .select()
      .from(import_decisions)
      .where(eq(import_decisions.id, decisionId))
      .limit(1);
    const decision = found[0];
    if (!decision) throw new Error("Decisión no encontrada");
    if (decision.processed) throw new Error("La decisión ya está procesada");

    const meta = decision.change_metadata as { conflicts?: { field: string; incomingValue: string }[]; id_user?: number } | null;
    if (action === "overwrite" && meta?.conflicts && decision.selected_user_id) {
      const update: Record<string, unknown> = {};
      for (const c of meta.conflicts) {
        update[c.field] = c.field === "birth_date" ? new Date(c.incomingValue) : c.incomingValue;
      }
      if (Object.keys(update).length) {
        await this.db.update(users).set(update as any).where(eq(users.id_user, decision.selected_user_id));
      }
    }
    await this.db
      .update(import_decisions)
      .set({ processed: true, decision_action: action === "overwrite" ? "update_and_link" : "skip", updated_at: new Date() })
      .where(eq(import_decisions.id, decisionId));
  }
}
