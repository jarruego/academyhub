import { Controller, Post, Body, Put, Param, Get, Query, Delete, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { CreateCourseDTO } from '../../dto/course/create-course.dto';
import { UpdateCourseDTO, COURSE_PLANNING_FIELDS } from '../../dto/course/update-course.dto';
import { CourseService } from './course.service';
import { FilterCourseDTO } from 'src/dto/course/filter-course.dto';
import { CreateUserCourseDTO } from "src/dto/user-course/create-user-course.dto";
import { UpdateUserCourseDTO } from 'src/dto/user-course/update-user-course.dto';
import { DeleteCourseDTO } from 'src/dto/course/delete-course.dto';
import { RoleGuard } from 'src/guards/role.guard';
import { Role } from 'src/guards/role.enum';
import { JwtPayload } from 'src/auth/auth.service';
import { pick } from 'src/utils/pick.util';

@Controller('course')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Post()
  async create(@Body() createCourseDTO: CreateCourseDTO) {
    return this.courseService.create(createCourseDTO);
  }

  // Guard ampliado a propósito: ADMIN/MANAGER tienen acceso completo (Ficha +
  // Planificación); quien no sea ninguno de los dos solo entra si tiene el
  // permiso puntual `can_manage_candidates`, y en ese caso queda restringido a
  // los campos de la pestaña Planificación y selección (COURSE_PLANNING_FIELDS)
  // — el resto se descarta en silencio, no se lanza error, porque el
  // formulario del cliente es compartido entre pestañas y siempre envía el
  // curso completo. Ver docs/security.md.
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER, Role.TUTOR]))
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateCourseDTO: UpdateCourseDTO, @Req() req: { user: JwtPayload }) {
    const numericId = parseInt(id, 10);
    const hasFullAccess = req.user.role === Role.ADMIN || req.user.role === Role.MANAGER;
    let data: Partial<UpdateCourseDTO> = updateCourseDTO;
    if (!hasFullAccess) {
      if (!req.user.can_manage_candidates) throw new ForbiddenException('No tienes permiso para editar este curso.');
      data = pick(updateCourseDTO, COURSE_PLANNING_FIELDS);
    }
    return this.courseService.update(numericId, data);
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
  @Get(':id/deletion-check')
  async getDeletionCheck(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.courseService.getDeletionCheck(numericId);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Delete(':id')
  async deleteById(@Param('id') id: string, @Query() query: DeleteCourseDTO) {
    const numericId = parseInt(id, 10);
    return this.courseService.deleteById(numericId, query.deleteEnrollments ?? false);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Delete(':id/users/:userId')
  async deleteUserFromCourse(@Param('id') id: string, @Param('userId') userId: string) {
    const numericCourseId = parseInt(id, 10);
    const numericUserId = parseInt(userId, 10);
    return this.courseService.deleteUserFromCourse(numericCourseId, numericUserId);
  }

}