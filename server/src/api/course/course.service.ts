import { Injectable } from "@nestjs/common";
import { CourseRepository } from "src/database/repository/course/course.repository";
import { CreateCourseDTO } from "src/dto/course/create-course.dto";
import { FilterCourseDTO } from "src/dto/course/filter-course.dto";
import { UpdateCourseDTO } from "src/dto/course/update-course.dto";
import { CreateUserCenterDTO } from "src/dto/user-center/create-user-center.dto";

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

  async addUserToCenter(createUserCenterDTO: CreateUserCenterDTO) {
    return await this.courseRepository.addUserToCenter(createUserCenterDTO);
  }

  async findUsersInCenter(centerId: number) {
    return await this.courseRepository.findUsersInCenter(centerId);
  }
}