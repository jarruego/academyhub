import { Controller, Post, Body, Put, Param, Get, Query, Delete, ParseIntPipe, HttpCode, Res } from '@nestjs/common';
import { CreateGroupDTO } from '../../dto/group/create-group.dto';
import { UpdateGroupDTO } from '../../dto/group/update-group.dto';
import { GroupService } from './group.service';
import { CreateUserGroupDTO } from '../../dto/user-group/create-user-group.dto';
import { FilterGroupDTO } from 'src/dto/group/filter-group.dto';
import { UpdateUserGroupDTO } from 'src/dto/user-group/update-user-group.dto';
import { GetBonificationFileDTO } from 'src/dto/group/get-bonification-file.dto';
import { Response } from 'express';

@Controller('group')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Post()
  async create(@Body() createGroupDTO: CreateGroupDTO) {
    return this.groupService.create(createGroupDTO);
  }

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

  @Post(':id/users/:userId')
  async addUserToGroup(@Param('id', new ParseIntPipe()) id: number, @Param('userId', new ParseIntPipe()) userId: number) {
    return this.groupService.addUserToGroup(id, userId);
  }

  @Get(':id/users')
  async findUsersInGroup(@Param('id', new ParseIntPipe()) id: number) {
    return this.groupService.findUsersInGroup(id);
  }

  @Delete(':id')
  async deleteById(@Param('id', new ParseIntPipe()) id: number) {
    return this.groupService.deleteById(id);
  }

  @Delete(':id/users/:userId')
  async deleteUserFromGroup(@Param('id') id: string, @Param('userId') userId: string) {
    const numericId = parseInt(id, 10);
    const numericUserId = parseInt(userId, 10);
    return this.groupService.deleteUserFromGroup(numericId, numericUserId);
  }

  @Put(':id/users/:userId')
  async updateUserInGroup(@Param('id') id: string, @Param('userId') userId: string, @Body() updateUserGroupDTO: UpdateUserGroupDTO) {
    const numericId = parseInt(id, 10);
    const numericUserId = parseInt(userId, 10);
    return this.groupService.updateUserInGroup(numericId, numericUserId, updateUserGroupDTO);
  }

  @Post('bonification-file')
  @HttpCode(200)
  async getBonificationFile(@Body() body: GetBonificationFileDTO) {
    return await this.groupService.getBonificationFile(body.groupId, body.userIds);
  }
}
