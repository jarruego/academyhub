import { Controller, Post, Body, Put, Param, Get, Query, Delete, UseGuards } from '@nestjs/common';
import { CreateUserDTO } from '../../dto/user/create-user.dto';
import { UpdateUserDTO } from '../../dto/user/update-user.dto';
import { UserService } from './user.service';
import { FilterUserDTO } from 'src/dto/user/filter-user.dto';
import { RoleGuard } from 'src/guards/role.guard';
import { Role } from 'src/guards/role.enum';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
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

  @Get(':id')
  async findById(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.userService.findById(numericId);
  }

  @Get()
  async findAll(@Query() filter: FilterUserDTO) {
    return this.userService.findAll(filter);
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
    return this.userService.importMoodleUsers();
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Post('bulk-create-and-add-to-group/:id_group')
  async bulkCreateAndAddToGroup(@Param('id_group') id_group: string, @Body() users: CreateUserDTO[]) {
    const numericGroupId = parseInt(id_group, 10);
    return this.userService.bulkCreateAndAddToGroup(users, numericGroupId);
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

}
