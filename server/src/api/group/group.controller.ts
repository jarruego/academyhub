import { Controller, Post, Body, Put, Param, Get, Query, Delete, ParseIntPipe, HttpCode, Res, UseGuards, BadRequestException } from '@nestjs/common';
import { CreateGroupDTO } from '../../dto/group/create-group.dto';
import { UpdateGroupDTO } from '../../dto/group/update-group.dto';
import { GroupService } from './group.service';
import { FilterGroupDTO } from 'src/dto/group/filter-group.dto';
import { UpdateUserGroupDTO } from 'src/dto/user-group/update-user-group.dto';
import { GetBonificationFileDTO } from 'src/dto/group/get-bonification-file.dto';
import { RoleGuard } from 'src/guards/role.guard';
import { Role } from 'src/guards/role.enum';
import { Response } from 'express';

@Controller('group')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  @Post('bonification-file')
  @HttpCode(200)
  async getBonificationFile(@Body() body: GetBonificationFileDTO, @Res() res: Response) {
    const { xml, filename } = await this.groupService.getBonificationFile(body.groupId, body.userIds);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(xml);
  }
  
  @UseGuards(RoleGuard([Role.ADMIN]))
  @Post()
  async create(@Body() createGroupDTO: CreateGroupDTO) {
    return this.groupService.create(createGroupDTO);
  }

  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateGroupDTO: UpdateGroupDTO) {
    const numericId = parseInt(id, 10);
    return this.groupService.update(numericId, updateGroupDTO);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.groupService.findById(numericId);
  }

  @Get()
  async findAll(@Query() filter: FilterGroupDTO ) {
    return this.groupService.findAll(filter);
  }

  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  @Post(':id/users/bulk-add')
  async bulkAddUsersToGroup(@Param('id', new ParseIntPipe()) id: number, @Body() body: { userIds: number[] }) {
    if (!body || !Array.isArray(body.userIds)) throw new BadRequestException('Invalid payload: expected { userIds: number[] }');
    return this.groupService.addUsersToGroup(id, body.userIds);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Post(':id/users/:userId')
  async addUserToGroup(@Param('id', new ParseIntPipe()) id: number, @Param('userId', new ParseIntPipe()) userId: number) {
    return this.groupService.addUserToGroup({id_user: userId, id_group: id});
  }

  @Get(':id/users')
  async findUsersInGroup(@Param('id', new ParseIntPipe()) id: number) {
    return this.groupService.findUsersInGroup(id);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Delete(':id')
  async deleteById(@Param('id', new ParseIntPipe()) id: number) {
    return this.groupService.deleteById(id);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Delete(':id/users/:userId')
  async deleteUserFromGroup(@Param('id') id: string, @Param('userId') userId: string) {
    const numericId = parseInt(id, 10);
    const numericUserId = parseInt(userId, 10);
    return this.groupService.deleteUserFromGroup(numericId, numericUserId);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Put(':id/users/:userId')
  async updateUserInGroup(@Param('id') id: string, @Param('userId') userId: string, @Body() updateUserGroupDTO: UpdateUserGroupDTO) {
    const numericId = parseInt(id, 10);
    const numericUserId = parseInt(userId, 10);
    return this.groupService.updateUserInGroup(numericId, numericUserId, updateUserGroupDTO);
  }

}
