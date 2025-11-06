import { Controller, Post, Body, Put, Param, Get, Query, Delete, UseGuards } from '@nestjs/common';
import { CreateCourseDTO } from '../../dto/course/create-course.dto';
import { UpdateCourseDTO } from '../../dto/course/update-course.dto';
import { CourseService } from './course.service';
import { FilterCourseDTO } from 'src/dto/course/filter-course.dto';
import { CreateUserCourseDTO } from "src/dto/user-course/create-user-course.dto";
import { UpdateUserCourseDTO } from 'src/dto/user-course/update-user-course.dto';
import { RoleGuard } from 'src/guards/role.guard';
import { Role } from 'src/guards/role.enum';

@Controller('course')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Post()
  async create(@Body() createCourseDTO: CreateCourseDTO) {
    return this.courseService.create(createCourseDTO);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
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

  @UseGuards(RoleGuard([Role.ADMIN]))
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

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Put(':id/users/:userId')
  async updateUserInCourse(@Param('id') id: string, @Param('userId') userId: string, @Body() updateUserCourseDTO: UpdateUserCourseDTO) {
    const numericCourseId = parseInt(id, 10);
    const numericUserId = parseInt(userId, 10);
    return this.courseService.updateUserInCourse(numericCourseId, numericUserId, updateUserCourseDTO);
  }

  // Endpoints for per-course roles were removed: roles are now handled at group-level (user_group.id_role)

  @Get(':id/groups')
  async findGroupsInCourse(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.courseService.findGroupsInCourse(numericId);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Delete(':id')
  async deleteById(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.courseService.deleteById(numericId);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Delete(':id/users/:userId')
  async deleteUserFromCourse(@Param('id') id: string, @Param('userId') userId: string) {
    const numericCourseId = parseInt(id, 10);
    const numericUserId = parseInt(userId, 10);
    return this.courseService.deleteUserFromCourse(numericCourseId, numericUserId);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Post('import-moodle-courses')
  async importMoodleCourses() {
    return await this.courseService.importMoodleCourses();
  }
}