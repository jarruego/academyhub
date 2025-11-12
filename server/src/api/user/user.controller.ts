import { Controller, Post, Body, Put, Param, Get, Query, Delete, UseGuards, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { CreateUserDTO } from '../../dto/user/create-user.dto';
import { UpdateUserDTO } from '../../dto/user/update-user.dto';
import { UserService } from './user.service';
import { MoodleService } from '../moodle/moodle.service';
import { FilterUserDTO } from 'src/dto/user/filter-user.dto';
import { RoleGuard } from 'src/guards/role.guard';
import { Role } from 'src/guards/role.enum';
import { PaginatedUsersResult, UserWithCenters } from 'src/types/user/paginated-users.interface';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly moodleService: MoodleService,
  ) {}

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Post()
  async create(@Body() createUserDTO: CreateUserDTO) {
    return this.userService.create(createUserDTO);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateUserDTO: UpdateUserDTO) {
    const numericId = parseInt(id, 10);
    return this.userService.update(numericId, updateUserDTO);
  }

  @Get()
  async findAll(@Query() filter: FilterUserDTO): Promise<PaginatedUsersResult | UserWithCenters[]> {
    // Si hay parámetros de paginación, usar el método paginado
    if (filter.page !== undefined || filter.limit !== undefined || filter.search) {
      return this.userService.findAllPaginated(filter);
    }
    // Método legacy para compatibilidad
    return this.userService.findAll(filter);
  }

  @Get('all')
  async findAllWithoutPagination(@Query() filter: FilterUserDTO) {
    return this.userService.findAll(filter);
  }

  // Endpoint ligero para devolver solo campos necesarios para lookup (dni, nombre, apellidos)
  @Get('lookup')
  async findAllLookup(@Query() filter: FilterUserDTO) {
    return this.userService.findAllMinimal(filter);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Delete(':id')
  async delete(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.userService.delete(numericId);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Post('import-moodle-users')
  async importMoodleUsers() {
    return this.moodleService.importMoodleUsers();
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Post('bulk-create-and-add-to-group/:id_group')
  async bulkCreateAndAddToGroup(@Param('id_group', ParseIntPipe) id_group: number, @Body() users: CreateUserDTO[]) {
    if (!Number.isFinite(id_group) || id_group <= 0) {
      throw new BadRequestException('Invalid group id');
    }
    return this.userService.bulkCreateAndAddToGroup(users, id_group);
  }

  @Get(':id/centers')
  async findCentersByUser(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.userService.findCentersByUserId(numericId);
  }

  @Get(':id/courses')
  async findCoursesByUser(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.userService.findCoursesByUserId(numericId);
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number) {
    // ParseIntPipe will automatically validate and throw if the param is not a valid integer.
    if (!Number.isFinite(id) || id <= 0) {
      throw new BadRequestException('Invalid user id');
    }
    return this.userService.findById(id);
  }

}
