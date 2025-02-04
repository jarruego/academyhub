import { Injectable } from "@nestjs/common";
import { GroupRepository } from "src/database/repository/group/group.repository";
import { CreateGroupDTO } from "src/dto/group/create-group.dto";
import { UpdateGroupDTO } from "src/dto/group/update-group.dto";
import { CreateUserGroupDTO } from "src/dto/user-group/create-user-group.dto";
import { FilterGroupDTO } from "src/dto/group/filter-group.dto";
import { UpdateUserGroupDTO } from "src/dto/user-group/update-user-group.dto";

@Injectable()
export class GroupService {
  constructor(private readonly groupRepository: GroupRepository) {}

  async findById(id: number) {
    return await this.groupRepository.findById(id);
  }

  async create(createGroupDTO: CreateGroupDTO) {
    return await this.groupRepository.create(createGroupDTO);
  }

  async update(id: number, updateGroupDTO: UpdateGroupDTO) {
    await this.groupRepository.update(id, updateGroupDTO);
    return await this.groupRepository.findById(id);
  }

  async findAll(filter: FilterGroupDTO) {
    return await this.groupRepository.findAll(filter);
  }

  async addUserToGroup(createUserGroupDTO: CreateUserGroupDTO) {
    console.log('GroupService - addUserToGroup - createUserGroupDTO:', createUserGroupDTO);
    return await this.groupRepository.addUserToGroup(createUserGroupDTO);
  }

  async findUsersInGroup(groupId: number) {
    return await this.groupRepository.findUsersInGroup(groupId);
  }

  async deleteById(id: number) {
    return await this.groupRepository.deleteById(id);
  }

  async deleteUserFromGroup(id_group: number, id_user: number) {
    return await this.groupRepository.deleteUserFromGroup(id_group, id_user);
  }

  async updateUserInGroup(id_group: number, id_user: number, updateUserGroupDTO: UpdateUserGroupDTO) {
    return await this.groupRepository.updateUserInGroup(id_group, id_user, updateUserGroupDTO);
  }
}
