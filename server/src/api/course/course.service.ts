import { Inject, Injectable } from "@nestjs/common";
import { CourseRepository } from "src/database/repository/course/course.repository";
import { UserCourseRepository } from "src/database/repository/course/user-course.repository";
import { MoodleService } from "../moodle/moodle.service";
import { GroupRepository } from "src/database/repository/group/group.repository";
import { UserRepository } from "src/database/repository/user/user.repository";
import { DatabaseService } from "src/database/database.service";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { QueryOptions } from "src/database/repository/repository";
import { MoodleCourse } from "src/types/moodle/course";
import { CourseModality } from "src/types/course/course-modality.enum";
import { UserService } from "../user/user.service";
import { CourseInsertModel, CourseSelectModel, CourseUpdateModel } from "src/database/schema/tables/course.table";
import { UserCourseInsertModel, UserCourseUpdateModel } from "src/database/schema/tables/user_course.table";
import { UserCourseRoleInsertModel } from "src/database/schema/tables/user_course_moodle_role.table";

@Injectable()
export class CourseService {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly userCourseRepository: UserCourseRepository,
    private readonly groupRepository: GroupRepository,
    private readonly MoodleService: MoodleService,
    private readonly userRepository: UserRepository,
    private readonly userService: UserService,
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService
  ) { }

  async findById(id: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.courseRepository.findById(id, { transaction });
    });
  }

  async create(courseInsertModel: CourseInsertModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.courseRepository.create(courseInsertModel, { transaction });
    });
  }

  async update(id: number, courseUpdateModel: CourseUpdateModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      await this.courseRepository.update(id, courseUpdateModel, { transaction });
      return await this.courseRepository.findById(id, { transaction });
    });
  }

  async findAll(filter: Partial<CourseSelectModel>, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.courseRepository.findAll(filter, { transaction });
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

  async deleteById(id: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.courseRepository.deleteById(id, { transaction });
    });
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

  async addUserRoleToCourse(userCourseRoleInsertModel: UserCourseRoleInsertModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.courseRepository.addUserRoleToCourse(userCourseRoleInsertModel, { transaction });
    });
  }

  //TODO: mejorar, se usa ¿UserCourseRoleInsertModel?
  async updateUserRolesInCourse(id_course: number, id_user: number, roles: UserCourseRoleInsertModel[], options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.courseRepository.updateUserRolesInCourse(id_course, id_user, roles, { transaction });
    });
  }

  async upsertMoodleCourse(moodleCourse: MoodleCourse, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const data = {
        course_name: moodleCourse.fullname,
        short_name: moodleCourse.shortname,
        moodle_id: moodleCourse.id,
        start_date: new Date(moodleCourse.startdate),
        end_date: new Date(moodleCourse.enddate),
        // Campos opcionales necesarios para la creación
        // TODO: comprobar si ya están definidos en la base de datos
        category: "",
        modality: CourseModality.ONLINE,
        hours: 0,
        price_per_hour: null,
        active: true,
        fundae_id: "",
      };
      const existingCourse = await this.courseRepository.findByMoodleId(moodleCourse.id, { transaction });
      if (existingCourse) {
        await this.courseRepository.update(existingCourse.id_course, data, { transaction });
        return await this.courseRepository.findByMoodleId(moodleCourse.id, { transaction });
      } else {
        const [{ id }] = await this.courseRepository.create(data, { transaction });
        return await this.courseRepository.findById(id, { transaction });
      }
    });
  }

  async importMoodleCourses() {
    return await this.databaseService.db.transaction(async transaction => {
      const moodleCourses = await this.MoodleService.getAllCourses();
      for (const moodleCourse of moodleCourses) {
        const course = await this.upsertMoodleCourse(moodleCourse, { transaction });

        // Obtener usuarios matriculados en el curso y comprobar si ya existen en la base de datos
        // y actualizarlos o crearlos si no existen
        const enrolledUsers = await this.MoodleService.getEnrolledUsers(moodleCourse.id);
        for (const enrolledUser of enrolledUsers) {
          // Saltar usuarios invitados
          if (enrolledUser.username === 'guest') {
            await this.userRepository.upsertMoodleUserByCourse(enrolledUser, course.id_course, { transaction }, null);
            continue;
          }
          try {
            const progress = await this.MoodleService.getUserProgressInCourse(enrolledUser, moodleCourse.id);
            await this.userRepository.upsertMoodleUserByCourse(enrolledUser, course.id_course, { transaction }, progress.completion_percentage);
          } catch (e) {
            // Si hay error (por ejemplo, guestsarenotallowed), guardar null
            await this.userRepository.upsertMoodleUserByCourse(enrolledUser, course.id_course, { transaction }, null);
          }
        }

        // Obtener grupos asociados al curso 
        const moodleGroups = await this.MoodleService.getCourseGroups(moodleCourse.id);
        for (const moodleGroup of moodleGroups) {
          const newGroup = await this.groupRepository.upsertMoodleGroup(moodleGroup, course.id_course, { transaction });

          // Obtener usuarios asociados al grupo
          const moodleUsers = await this.MoodleService.getGroupUsers(moodleGroup.id);
          for (const moodleUser of moodleUsers) {
            await this.userService.upsertMoodleUserByGroup(moodleUser, newGroup.id_group, { transaction });
          }
        }

      }

      return { message: 'Cursos, grupos y usuarios importados y actualizados correctamente' };
    });
  }

  async findGroupsInCourse(courseId: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.groupRepository.findGroupsByCourseId(courseId, { transaction });
    });
  }
}