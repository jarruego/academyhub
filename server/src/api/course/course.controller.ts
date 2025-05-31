import { Controller, Post, Body, Put, Param, Get, Query, Delete } from '@nestjs/common';
import { CreateCourseDTO } from '../../dto/course/create-course.dto';
import { UpdateCourseDTO } from '../../dto/course/update-course.dto';
import { CourseService } from './course.service';
import { FilterCourseDTO } from 'src/dto/course/filter-course.dto';
import { CreateUserCourseDTO } from "src/dto/user-course/create-user-course.dto";
import { UpdateUserCourseDTO } from 'src/dto/user-course/update-user-course.dto';
import { CreateUserCourseRoleDTO } from "src/dto/user-course-role/create-user-course-role.dto";

@Controller('course')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Post()
  async create(@Body() createCourseDTO: CreateCourseDTO) {
    return this.courseService.create(createCourseDTO);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateCourseDTO: UpdateCourseDTO) {
    const numericId = parseInt(id, 10);
    return this.courseService.update(numericId, updateCourseDTO);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.courseService.findById(numericId);
  }

  @Get()
  async findAll(@Query() filter: FilterCourseDTO) {
    return this.courseService.findAll(filter);
  }

  @Post(':id/users')
  async addUserToCourse(@Param('id') id: string, @Body() createUserCourseDTO: CreateUserCourseDTO) {
    createUserCourseDTO.id_course = parseInt(id, 10);
    return this.courseService.addUserToCourse(createUserCourseDTO);
  }

  @Get(':id/users')
  async findUsersInCourse(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.courseService.findUsersInCourse(numericId);
  }

  @Put(':id/users/:userId')
  async updateUserInCourse(@Param('id') id: string, @Param('userId') userId: string, @Body() updateUserCourseDTO: UpdateUserCourseDTO) {
    const numericCourseId = parseInt(id, 10);
    const numericUserId = parseInt(userId, 10);
    return this.courseService.updateUserInCourse(numericCourseId, numericUserId, updateUserCourseDTO);
  }

  @Post(':id/users/:userId/roles')
  async addUserRoleToCourse(@Param('id') id: string, @Param('userId') userId: string, @Body() createUserCourseRoleDTO: CreateUserCourseRoleDTO) {
    createUserCourseRoleDTO.id_course = parseInt(id, 10);
    createUserCourseRoleDTO.id_user = parseInt(userId, 10);
    return this.courseService.addUserRoleToCourse(createUserCourseRoleDTO);
  }

  @Put(':id/users/:userId/roles')
  async updateUserRolesInCourse(@Param('id') id: string, @Param('userId') userId: string, @Body() roles: CreateUserCourseRoleDTO[]) {
    const numericCourseId = parseInt(id, 10);
    const numericUserId = parseInt(userId, 10);
    return this.courseService.updateUserRolesInCourse(numericCourseId, numericUserId, roles);
  }

  @Get(':id/groups')
  async findGroupsInCourse(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.courseService.findGroupsInCourse(numericId);
  }

  @Delete(':id')
  async deleteById(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.courseService.deleteById(numericId);
  }

  @Delete(':id/users/:userId')
  async deleteUserFromCourse(@Param('id') id: string, @Param('userId') userId: string) {
    const numericCourseId = parseInt(id, 10);
    const numericUserId = parseInt(userId, 10);
    return this.courseService.deleteUserFromCourse(numericCourseId, numericUserId);
  }

  @Post('import-moodle-courses')
  async importMoodleCourses() {
    return await this.courseService.importMoodleCourses();
  }
}