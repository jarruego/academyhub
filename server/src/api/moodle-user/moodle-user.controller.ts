import { Controller, Post, Body, Put, Param, Get, Query, Delete, UseGuards } from '@nestjs/common';
import { CreateMoodleUserDTO } from '../../dto/moodle-user/create-moodle-user.dto';
import { UpdateMoodleUserDTO } from '../../dto/moodle-user/update-moodle-user.dto';
import { FilterMoodleUserDTO } from '../../dto/moodle-user/filter-moodle-user.dto';
import { MoodleUserService } from './moodle-user.service';
import { RoleGuard } from 'src/guards/role.guard';
import { Role } from 'src/guards/role.enum';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('moodle-users')
@Controller('moodle-user')
export class MoodleUserController {
  constructor(
    private readonly moodleUserService: MoodleUserService,
  ) {}

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Post()
  @ApiOperation({ summary: 'Crear nuevo usuario de Moodle' })
  @ApiResponse({ status: 201, description: 'Usuario de Moodle creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async create(@Body() createMoodleUserDTO: CreateMoodleUserDTO) {
    return this.moodleUserService.create(createMoodleUserDTO);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Put(':id')
  @ApiOperation({ summary: 'Actualizar usuario de Moodle' })
  @ApiResponse({ status: 200, description: 'Usuario de Moodle actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario de Moodle no encontrado' })
  async update(@Param('id') id: string, @Body() updateMoodleUserDTO: UpdateMoodleUserDTO) {
    const numericId = parseInt(id, 10);
    return this.moodleUserService.update(numericId, updateMoodleUserDTO);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener usuario de Moodle por ID' })
  @ApiResponse({ status: 200, description: 'Usuario de Moodle encontrado' })
  @ApiResponse({ status: 404, description: 'Usuario de Moodle no encontrado' })
  async findById(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.moodleUserService.findById(numericId);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los usuarios de Moodle con filtros opcionales' })
  @ApiResponse({ status: 200, description: 'Lista de usuarios de Moodle' })
  async findAll(@Query() filter: FilterMoodleUserDTO) {
    return this.moodleUserService.findAll(filter);
  }

  @Get(':id/courses')
  @ApiOperation({ summary: 'Obtener cursos asociados a un usuario de Moodle (id_moodle_user)' })
  @ApiResponse({ status: 200, description: 'Lista de cursos asociados' })
  async findCoursesByMoodleUser(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.moodleUserService.findCoursesByMoodleUserId(numericId);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar usuario de Moodle' })
  @ApiResponse({ status: 200, description: 'Usuario de Moodle eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario de Moodle no encontrado' })
  async delete(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.moodleUserService.delete(numericId);
  }

  @Get('/by-user/:userId')
  @ApiOperation({ summary: 'Obtener todas las cuentas de Moodle de un usuario específico' })
  @ApiResponse({ status: 200, description: 'Lista de cuentas de Moodle del usuario' })
  async findByUserId(@Param('userId') userId: string) {
    const numericUserId = parseInt(userId, 10);
    return this.moodleUserService.findByUserId(numericUserId);
  }

  @Get('/by-moodle-id/:moodleId')
  @ApiOperation({ summary: 'Obtener usuario de Moodle por moodle_id' })
  @ApiResponse({ status: 200, description: 'Usuario de Moodle encontrado' })
  @ApiResponse({ status: 404, description: 'Usuario de Moodle no encontrado' })
  async findByMoodleId(@Param('moodleId') moodleId: string) {
    const numericMoodleId = parseInt(moodleId, 10);
    return this.moodleUserService.findByMoodleId(numericMoodleId);
  }

  @Get('/by-username/:username')
  @ApiOperation({ summary: 'Obtener usuario de Moodle por username' })
  @ApiResponse({ status: 200, description: 'Usuario de Moodle encontrado' })
  @ApiResponse({ status: 404, description: 'Usuario de Moodle no encontrado' })
  async findByUsername(@Param('username') username: string) {
    return this.moodleUserService.findByUsername(username);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Post('/link')
  @ApiOperation({ summary: 'Vincular usuario existente con cuenta de Moodle' })
  @ApiResponse({ status: 201, description: 'Usuario vinculado exitosamente' })
  @ApiResponse({ status: 400, description: 'Error de vinculación (duplicados, etc.)' })
  async linkUserToMoodle(@Body() linkData: {
    userId: number;
    moodleId: number;
    moodleUsername: string;
    moodlePassword?: string;
  }) {
    return this.moodleUserService.linkUserToMoodle(
      linkData.userId,
      linkData.moodleId,
      linkData.moodleUsername,
      linkData.moodlePassword
    );
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Post('/init-usernames')
  @ApiOperation({ summary: 'Inicializar moodle_username para todos los moodle_users' })
  @ApiResponse({ status: 200, description: 'Inicialización completada' })
  @ApiResponse({ status: 500, description: 'Error interno' })
  async initializeUsernames() {
    return this.moodleUserService.initializeUsernames();
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Delete('/unlink/:moodleUserId')
  @ApiOperation({ summary: 'Desvincular usuario de cuenta de Moodle' })
  @ApiResponse({ status: 200, description: 'Usuario desvinculado exitosamente' })
  async unlinkUserFromMoodle(@Param('moodleUserId') moodleUserId: string) {
    const numericMoodleUserId = parseInt(moodleUserId, 10);
    return this.moodleUserService.unlinkUserFromMoodle(numericMoodleUserId);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Get('/stats/overview')
  @ApiOperation({ summary: 'Obtener estadísticas de usuarios de Moodle' })
  @ApiResponse({ status: 200, description: 'Estadísticas de usuarios de Moodle' })
  async getStats() {
    return this.moodleUserService.getStats();
  }
}