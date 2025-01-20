import { Controller, Post, Body, Put, Param, Get, Query } from '@nestjs/common';
import { CreateCourseDTO } from '../../dto/course/create-course.dto';
import { UpdateCourseDTO } from '../../dto/course/update-course.dto';
import { CourseService } from './course.service';
import { FilterCourseDTO } from 'src/dto/course/filter-course.dto';
import { CreateUserCourseDTO } from "src/dto/user-course/create-user-course.dto";

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
}