import { Injectable } from "@nestjs/common";
import { CourseRepository } from "src/database/repository/course/course.repository";
import { CreateCourseDTO } from "src/dto/course/create-course.dto";
import { FilterCourseDTO } from "src/dto/course/filter-course.dto";
import { UpdateCourseDTO } from "src/dto/course/update-course.dto";
import { CreateUserCourseDTO } from "src/dto/user-course/create-user-course.dto";

@Injectable()
export class CourseService {
  constructor(private readonly courseRepository: CourseRepository) {}

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
}