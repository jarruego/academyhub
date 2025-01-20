import { Controller, Post, Body, Put, Param, Get, Query } from '@nestjs/common';
import { CreateGroupDTO } from '../../dto/group/create-group.dto';
import { UpdateGroupDTO } from '../../dto/group/update-group.dto';
import { GroupService } from './group.service';
import { CreateUserGroupDTO } from '../../dto/user-group/create-user-group.dto';

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
  async findAll(@Query() query: any) {
    return this.groupService.findAll(query);
  }

  @Post(':id/users')
  async addUserToGroup(@Param('id') id: string, @Body() createUserGroupDTO: CreateUserGroupDTO) {
    createUserGroupDTO.id_group = parseInt(id, 10);
    return this.groupService.addUserToGroup(createUserGroupDTO);
  }

  @Get(':id/users')
  async findUsersInGroup(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.groupService.findUsersInGroup(numericId);
  }
}
