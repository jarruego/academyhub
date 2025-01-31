import { Inject, Injectable } from "@nestjs/common";
import { CourseRepository } from "src/database/repository/course/course.repository";
import { CreateCourseDTO } from "src/dto/course/create-course.dto";
import { FilterCourseDTO } from "src/dto/course/filter-course.dto";
import { UpdateCourseDTO } from "src/dto/course/update-course.dto";
import { CreateUserCourseDTO } from "src/dto/user-course/create-user-course.dto";
import { UpdateUserCourseDTO } from "src/dto/user-course/update-user-course.dto";
import { CreateUserCourseRoleDTO } from "src/dto/user-course-role/create-user-course-role.dto";
import { MoodleService } from "../moodle/moodle.service";
import { GroupRepository } from "src/database/repository/group/group.repository";
import { UserRepository } from "src/database/repository/user/user.repository";
import { DatabaseService } from "src/database/database.service";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { QueryOptions } from "src/database/repository/repository";
import { MoodleCourse } from "src/types/moodle/course";
import { CourseModality } from "src/types/course/course-modality.enum";
// import { CourseModality } from "src/types/course/course-modality.enum";

@Injectable()
export class CourseService {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly groupRepository: GroupRepository,
    private readonly MoodleService: MoodleService,
    private readonly userRepository: UserRepository,
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService
  ) {}

  async findById(id: number) {
    return await this.courseRepository.findById(id);
  }

  async create(createCourseDTO: CreateCourseDTO) {
    return await this.courseRepository.create(createCourseDTO);
  }

  async update(id: number, updateCourseDTO: UpdateCourseDTO) {
    await this.courseRepository.update(id, updateCourseDTO);
    return await this.courseRepository.findById(id);
  }

  async findAll(filter: FilterCourseDTO) {
    return await this.courseRepository.findAll(filter);
  }

  async addUserToCourse(createUserCourseDTO: CreateUserCourseDTO) {
    return await this.courseRepository.addUserToCourse(createUserCourseDTO);
  }

  async findUsersInCourse(courseId: number) {
    return await this.courseRepository.findUsersInCourse(courseId);
  }

  async deleteById(id: number) {
    return await this.courseRepository.deleteById(id);
  }

  async updateUserInCourse(id_course: number, id_user: number, updateUserCourseDTO: UpdateUserCourseDTO) {
    return await this.courseRepository.updateUserInCourse(id_course, id_user, updateUserCourseDTO);
  }

  async deleteUserFromCourse(id_course: number, id_user: number) {
    return await this.courseRepository.deleteUserFromCourse(id_course, id_user);
  }

  async addUserRoleToCourse(createUserCourseRoleDTO: CreateUserCourseRoleDTO) {
    return await this.courseRepository.addUserRoleToCourse(createUserCourseRoleDTO);
  }

  async updateUserRolesInCourse(id_course: number, id_user: number, roles: CreateUserCourseRoleDTO[]) {
    return await this.courseRepository.updateUserRolesInCourse(id_course, id_user, roles);
  }

  async upsertMoodleCourse(moodleCourse: MoodleCourse, options?: QueryOptions) {
    const data = {
        course_name: moodleCourse.fullname,
        short_name: moodleCourse.shortname,
        moodle_id: moodleCourse.id,
        start_date: new Date(moodleCourse.startdate),
        end_date: new Date(moodleCourse.enddate),
        category: "",

        // Fixed for moodle
        modality: CourseModality.ONLINE,
      };
    const existingCourse = await this.courseRepository.findByMoodleId(moodleCourse.id, options);
    if (existingCourse) {
      await this.courseRepository.update(existingCourse.id_course, data, options);
      return await this.courseRepository.findByMoodleId(moodleCourse.id, options); // TODO: optimize
    } else {
      const [{id}] = await this.courseRepository.create(data, options);
      return await this.courseRepository.findById(id, options);
    }
  }

  async importMoodleCourses() {
    return await this.databaseService.db.transaction(async transaction => {
      const moodleCourses = await this.MoodleService.getAllCourses();
          for (const moodleCourse of moodleCourses) {
            const course = await this.upsertMoodleCourse(moodleCourse, {transaction});

            // Obtener usuarios matriculados en el curso
            const enrolledUsers = await this.MoodleService.getEnrolledUsers(moodleCourse.id);
            for (const enrolledUser of enrolledUsers) {
              await this.userRepository.upsertMoodleUserByCourse(enrolledUser, course.id_course, {transaction});
            }

            // Obtener grupos asociados al curso
            const moodleGroups = await this.MoodleService.getCourseGroups(moodleCourse.id);
            for (const moodleGroup of moodleGroups) {
              const newGroup = await this.groupRepository.upsertMoodleGroup(moodleGroup, course.id_course, {transaction});

              // Obtener usuarios asociados al grupo
              const moodleUsers = await this.MoodleService.getGroupUsers(moodleGroup.id);
              for (const moodleUser of moodleUsers) {
                await this.userRepository.upsertMoodleUserByGroup(moodleUser, newGroup.id_group, {transaction});
              }
            }
            
          }

        return { message: 'Cursos, grupos y usuarios importados y actualizados correctamente' };
    });
  }

  async findGroupsInCourse(courseId: number) {
    return await this.groupRepository.findGroupsByCourseId(courseId);
  }
}