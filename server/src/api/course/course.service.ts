import { Inject, Injectable, ConflictException } from "@nestjs/common";
import { CourseRepository } from "src/database/repository/course/course.repository";
import { UserCourseRepository } from "src/database/repository/course/user-course.repository";
import { MoodleService } from "../moodle/moodle.service";
import { MoodleUserService } from "../moodle-user/moodle-user.service";
import { GroupRepository } from "src/database/repository/group/group.repository";
import { UserRepository } from "src/database/repository/user/user.repository";
import { DatabaseService } from "src/database/database.service";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { QueryOptions } from "src/database/repository/repository";
import { MoodleCourse } from "src/types/moodle/course";
import { resolveInsertId } from "src/utils/db";
import { CourseModality } from "src/types/course/course-modality.enum";
import { UserService } from "../user/user.service";
import { CourseInsertModel, CourseSelectModel, CourseUpdateModel } from "src/database/schema/tables/course.table";
import { UserCourseInsertModel, UserCourseUpdateModel } from "src/database/schema/tables/user_course.table";
import { UserPreinscriptionRepository } from "src/database/repository/preinscription/user-preinscription.repository";

/**
 * Dependencias que retienen un curso (las 3 FKs que apuntan a `courses`).
 * `groups` y `preinscriptions` bloquean el borrado; `enrollments` sólo avisa
 * y puede arrastrarse con `deleteEnrollments`.
 */
export interface CourseDeletionCheck {
  groups: number;
  enrollments: number;
  preinscriptions: number;
  /** true si el curso se puede borrar sin arrastrar nada. */
  canDelete: boolean;
  /** true si sólo faltan las matrículas por confirmar (aviso + cascada opcional). */
  requiresEnrollmentDeletion: boolean;
}

@Injectable()
export class CourseService {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly userCourseRepository: UserCourseRepository,
    private readonly userPreinscriptionRepository: UserPreinscriptionRepository,
    private readonly groupRepository: GroupRepository,
    private readonly MoodleService: MoodleService,
    private readonly moodleUserService: MoodleUserService,
    private readonly userRepository: UserRepository,
    private readonly userService: UserService,
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService
  ) { }

  async findById(id: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.courseRepository.findById(id, { transaction });
    });
  }

  // Normaliza el nÂº de expediente: recorta y convierte el vacÃ­o en null
  // (evita que dos cursos sin expediente colisionen con la restricciÃ³n Ãºnica).
  private normalizeFileNumber<T extends { file_number?: string | null }>(model: T): T {
    if (model.file_number !== undefined) {
      const trimmed = (model.file_number ?? "").trim();
      model.file_number = trimmed.length ? trimmed : null;
    }
    return model;
  }

  // Postgres lanza 23505 al violar la restricciÃ³n Ãºnica de file_number.
  private isFileNumberConflict(error: unknown): boolean {
    const e = error as { code?: string; constraint?: string };
    return e?.code === "23505" && String(e?.constraint ?? "").includes("file_number");
  }

  async create(courseInsertModel: CourseInsertModel, options?: QueryOptions) {
    try {
      return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
        // Asegura que el campo contents estÃ© presente aunque sea undefined
        const data: CourseInsertModel = this.normalizeFileNumber({
          ...courseInsertModel,
          contents: courseInsertModel.contents ?? null,
        });
        return await this.courseRepository.create(data, { transaction });
      });
    } catch (error) {
      if (this.isFileNumberConflict(error)) {
        throw new ConflictException(`Ya existe un curso con el nÂº de expediente "${courseInsertModel.file_number}".`);
      }
      throw error;
    }
  }

  async update(id: number, courseUpdateModel: CourseUpdateModel, options?: QueryOptions) {
    try {
      return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
        // Asegura que el campo contents estÃ© presente aunque sea undefined
        const data: CourseUpdateModel = this.normalizeFileNumber({
          ...courseUpdateModel,
          contents: courseUpdateModel.contents ?? null,
        });
        await this.courseRepository.update(id, data, { transaction });
        return await this.courseRepository.findById(id, { transaction });
      });
    } catch (error) {
      if (this.isFileNumberConflict(error)) {
        throw new ConflictException(`Ya existe un curso con el nÂº de expediente "${courseUpdateModel.file_number}".`);
      }
      throw error;
    }
  }

  async findAll(filter: Partial<CourseSelectModel> & { search?: string }, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.courseRepository.findAll(filter, { transaction });
    });
  }

  async findByMoodleId(moodleId: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.courseRepository.findByMoodleId(moodleId, { transaction });
    });
  }

  async addUserToCourse(userCourseInsertModel: UserCourseInsertModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.userCourseRepository.addUserToCourse(userCourseInsertModel, { transaction });
    });
  }

  async findUsersInCourse(courseId: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.userCourseRepository.findUsersInCourse(courseId, { transaction });
    });
  }

  // Postgres lanza 23503 al violar una FK. Red de seguridad por si en el futuro
  // aparece otra tabla que referencie courses y no esté contemplada en el chequeo.
  private isForeignKeyViolation(error: unknown): boolean {
    return (error as { code?: string })?.code === "23503";
  }

  private async buildDeletionCheck(id: number, options: QueryOptions): Promise<CourseDeletionCheck> {
    const groups = await this.groupRepository.countByCourse(id, options);
    const enrollments = await this.userCourseRepository.countByCourse(id, options);
    const preinscriptions = await this.userPreinscriptionRepository.countByCourse(id, options);
    const blocked = groups > 0 || preinscriptions > 0;
    return {
      groups,
      enrollments,
      preinscriptions,
      canDelete: !blocked && enrollments === 0,
      requiresEnrollmentDeletion: !blocked && enrollments > 0,
    };
  }

  /** Qué retiene al curso, para que el cliente avise antes de borrar. */
  async getDeletionCheck(id: number, options?: QueryOptions): Promise<CourseDeletionCheck> {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.buildDeletionCheck(id, { transaction });
    });
  }

  /**
   * Borra un curso. Los grupos y las preinscripciones lo bloquean (nunca se
   * arrastran). Las matrículas sólo se borran si `deleteEnrollments` lo pide
   * explícitamente; se borra la fila de `user_course`, nunca el usuario.
   */
  async deleteById(id: number, deleteEnrollments = false, options?: QueryOptions) {
    try {
      return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
        const check = await this.buildDeletionCheck(id, { transaction });

        if (check.preinscriptions > 0) {
          throw new ConflictException(
            `No se puede eliminar el curso: tiene ${check.preinscriptions} preinscripción(es) asociada(s). Bórralas primero desde la pestaña Preinscripciones.`,
          );
        }
        if (check.groups > 0) {
          throw new ConflictException(
            `No se puede eliminar el curso: tiene ${check.groups} grupo(s). Bórralos primero.`,
          );
        }
        if (check.enrollments > 0) {
          if (!deleteEnrollments) {
            throw new ConflictException(
              `No se puede eliminar el curso: tiene ${check.enrollments} matrícula(s). Confirma el borrado de las matrículas para continuar.`,
            );
          }
          await this.userCourseRepository.deleteByCourse(id, { transaction });
        }

        return await this.courseRepository.deleteById(id, { transaction });
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (this.isForeignKeyViolation(error)) {
        throw new ConflictException(
          "No se puede eliminar el curso: todavía tiene datos asociados.",
        );
      }
      throw error;
    }
  }

  async updateUserInCourse(id_course: number, id_user: number, userCourseUpdateModel: UserCourseUpdateModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.userCourseRepository.updateUserInCourse(id_course, id_user, userCourseUpdateModel, { transaction });
    });
  }

  async deleteUserFromCourse(id_course: number, id_user: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.userCourseRepository.deleteUserFromCourse(id_course, id_user, { transaction });
    });
  }


  async upsertMoodleCourse(moodleCourse: MoodleCourse, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const data = {
        course_name: moodleCourse.fullname,
        short_name: moodleCourse.shortname,
        moodle_id: moodleCourse.id,
        start_date: new Date(moodleCourse.startdate * 1000),
        end_date: (moodleCourse.enddate && moodleCourse.enddate > 0) ? new Date(moodleCourse.enddate * 1000) : null,
        category: "",
        modality: CourseModality.ONLINE,
        hours: 0,
        price_per_hour: null,
        // `active` is no longer forced here: the course's active state is
        // derived from its groups (see utils/group-active.util.ts).
        fundae_id: "",
      } as Partial<CourseInsertModel>;

      // Business-layer upsert: try find -> update -> create -> fallback fetch
      const existing = await this.courseRepository.findByMoodleId(moodleCourse.id, { transaction });
      if (existing) {
        await this.courseRepository.update(existing.id_course, data as CourseUpdateModel, { transaction });
        return await this.courseRepository.findById(existing.id_course, { transaction });
      }

      try {
        const created = await this.courseRepository.create(data as CourseInsertModel, { transaction });
        // Use shared util to resolve inserted id
  const newId = resolveInsertId(created as unknown);
        if (newId) return await this.courseRepository.findById(Number(newId), { transaction });
        return await this.courseRepository.findByMoodleId(moodleCourse.id, { transaction });
      } catch (e) {
        // likely a duplicate/race: try to fetch existing
        try {
          const found = await this.courseRepository.findByMoodleId(moodleCourse.id, { transaction });
          if (found) return found;
        } catch (ee) {}
        throw e;
      }
    });
  }

  // Upsert a course from a generic payload (used by importers). This avoids assumptions
  // about Moodle-specific fields (startdate/enddate) and delegates to repository logic.
  async upsertCourse(payload: Partial<CourseInsertModel>, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const moodleId = payload?.moodle_id as number | undefined;

      // If moodle_id present try find -> update
      if (moodleId) {
        const existing = await this.courseRepository.findByMoodleId(moodleId, { transaction });
        if (existing) {
          await this.courseRepository.update(existing.id_course, payload as CourseUpdateModel, { transaction });
          return await this.courseRepository.findById(existing.id_course, { transaction });
        }
      }

      // Try create and resolve persisted row
      try {
        const created = await this.courseRepository.create(payload as CourseInsertModel, { transaction });
        const newId = resolveInsertId(created as unknown);
        if (newId) return await this.courseRepository.findById(Number(newId), { transaction });
        if (moodleId) return await this.courseRepository.findByMoodleId(moodleId, { transaction });
        return Array.isArray(created) ? created[0] : created;
      } catch (e) {
        // fallback: try fetch by moodle id if available, else rethrow
        if (moodleId) {
          try {
            const found = await this.courseRepository.findByMoodleId(moodleId, { transaction });
            if (found) return found;
          } catch (ee) {}
        }
        throw e;
      }
    });
  }

  async findGroupsInCourse(courseId: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.groupRepository.findGroupsByCourseId(courseId, { transaction });
    });
  }
}
