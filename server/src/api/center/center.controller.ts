import { Controller, Post, Body, Put, Param, Get, Query, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CreateCenterDTO } from '../../dto/center/create-center.dto';
import { UpdateCenterDTO } from '../../dto/center/update-center.dto';
import { CenterService } from './center.service';
import { FilterCenterDTO } from 'src/dto/center/filter-center.dto';
import { CreateUserCenterDTO } from "src/dto/user-center/create-user-center.dto";
import { UpdateUserCenterDTO } from 'src/dto/user-center/update-user-center.dto';
import { UpdateUsersMainCenterDTO } from 'src/dto/center/update-users-main-center.dto';
import { RoleGuard } from 'src/guards/role.guard';
import { Role } from 'src/guards/role.enum';

@Controller('center')
export class CenterController {
  constructor(private readonly centerService: CenterService) {}

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Post()
  async create(@Body() createCenterDTO: CreateCenterDTO) {
    return this.centerService.create(createCenterDTO);
  }

  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  @Put('users-main-center')
  async updateUsersMainCenter(@Body() body: UpdateUsersMainCenterDTO) {
    await this.centerService.updateUsersMainCenters(body.users);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Put(':id')
  async update(@Param('id', new ParseIntPipe()) id: number, @Body() updateCenterDTO: UpdateCenterDTO) {
    return this.centerService.update(id, updateCenterDTO);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.centerService.findById(numericId);
  }

  @Get()
  async findAll(@Query() filter: FilterCenterDTO) {
    return this.centerService.findAll(filter);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Post(':id/users')
  async addUserToCenter(@Param('id') id: string, @Body() createUserCenterDTO: Omit<CreateUserCenterDTO, 'id_center'>) {
    const dto = {
      ...createUserCenterDTO,
      id_center: parseInt(id, 10),
      start_date: createUserCenterDTO.start_date ? new Date(createUserCenterDTO.start_date) : undefined,
      end_date: createUserCenterDTO.end_date ? new Date(createUserCenterDTO.end_date) : undefined,
      is_main_center: createUserCenterDTO.is_main_center ?? false
    };
    return this.centerService.addUserToCenter(dto);
  }

  @Get(':id/users')
  async findUsersInCenter(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.centerService.findUsersInCenter(numericId);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Put(':id/users/:userId')
  async updateUserInCenter(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() updateUserCenterDTO: UpdateUserCenterDTO
  ) {
    const numericCenterId = parseInt(id, 10);
    const numericUserId = parseInt(userId, 10);
    const dto = {
      ...updateUserCenterDTO,
      start_date: updateUserCenterDTO.start_date ? new Date(updateUserCenterDTO.start_date) : undefined,
      end_date: updateUserCenterDTO.end_date ? new Date(updateUserCenterDTO.end_date) : undefined,
    };
    return this.centerService.updateUserInCenter(numericCenterId, numericUserId, dto);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Delete(':id')
  async delete(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.centerService.deleteById(numericId);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Delete(':id/users/:userId')
  async deleteUserFromCenter(@Param('id') id: string, @Param('userId') userId: string) {
    const numericCenterId = parseInt(id, 10);
    const numericUserId = parseInt(userId, 10);
    return this.centerService.deleteUserFromCenter(numericCenterId, numericUserId);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Get(":id/company")
  async getCompanyOfCenter(@Param("id") id: string) {
    const numericId = parseInt(id, 10);
    const center = await this.centerService.findById(numericId);
    if (!center) throw new Error("Centro no encontrado");
    // Buscar la empresa asociada
    return this.centerService.getCompanyOfCenter(numericId);
  }
}