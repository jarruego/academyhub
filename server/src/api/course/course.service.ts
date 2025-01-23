import { Injectable } from "@nestjs/common";
import { CourseRepository } from "src/database/repository/course/course.repository";
import { CreateCourseDTO } from "src/dto/course/create-course.dto";
import { FilterCourseDTO } from "src/dto/course/filter-course.dto";
import { UpdateCourseDTO } from "src/dto/course/update-course.dto";
import { CreateUserCourseDTO } from "src/dto/user-course/create-user-course.dto";
import { UpdateUserCourseDTO } from "src/dto/user-course/update-user-course.dto";
import { CreateUserCourseRoleDTO } from "src/dto/user-course-role/create-user-course-role.dto";
import { MoodleService } from "../moodle/moodle.service";
import { CourseModality } from "src/types/course/course-modality.enum";

@Injectable()
export class CourseService {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly MoodleService: MoodleService
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

  async importMoodleCourses() {
    const moodleCourses = await this.MoodleService.getAllCourses();
    for (const moodleCourse of moodleCourses) {
      const existingCourse = await this.courseRepository.findByMoodleId(moodleCourse.id);
      if (existingCourse) {
        await this.update(existingCourse.id_course, {
          course_name: moodleCourse.fullname,
          short_name: moodleCourse.shortname,
          moodle_id: moodleCourse.id,
          start_date: new Date(moodleCourse.startdate * 1000),
          end_date: new Date(moodleCourse.enddate * 1000),
          category: ""
        });
      } else {
        await this.create({
          course_name: moodleCourse.fullname,
          short_name: moodleCourse.shortname,
          moodle_id: moodleCourse.id,
          start_date: new Date(moodleCourse.startdate * 1000),
          end_date: new Date(moodleCourse.enddate * 1000),
          category: ""
        });
      }
    }
    return { message: 'Cursos importados y actualizados correctamente' };
  }
}