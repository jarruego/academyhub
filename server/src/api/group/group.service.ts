import { Injectable } from "@nestjs/common";
import { GroupRepository } from "src/database/repository/group/group.repository";
import { CreateGroupDTO } from "src/dto/group/create-group.dto";
import { UpdateGroupDTO } from "src/dto/group/update-group.dto";
import { CreateUserGroupDTO } from "src/dto/user-group/create-user-group.dto";
import { FilterGroupDTO } from "src/dto/group/filter-group.dto";
import { UpdateUserGroupDTO } from "src/dto/user-group/update-user-group.dto";
import { QueryOptions } from "src/database/repository/repository";

@Injectable()
export class GroupService {
  constructor(private readonly groupRepository: GroupRepository) {}

  async findById(id: number, options?: QueryOptions) {
    return await this.groupRepository.findById(id);
  }

  async create(createGroupDTO: CreateGroupDTO, options?: QueryOptions) {
    return await this.groupRepository.create(createGroupDTO);
  }

  async update(id: number, updateGroupDTO: UpdateGroupDTO, options?: QueryOptions) {
    await this.groupRepository.update(id, updateGroupDTO);
    return await this.groupRepository.findById(id);
  }

  async findAll(filter: FilterGroupDTO, options?: QueryOptions) {
    return await this.groupRepository.findAll(filter);
  }

  async addUserToGroup(id_group: number, id_user: number, options?: QueryOptions) {
    return await this.groupRepository.addUserToGroup(id_group, id_user);
  }

  async findUsersInGroup(groupId: number, options?: QueryOptions) {
    return await this.groupRepository.findUsersInGroup(groupId);
  }

  async deleteById(id: number, options?: QueryOptions) {
    return await this.groupRepository.deleteById(id);
  }

  async deleteUserFromGroup(id_group: number, id_user: number, options?: QueryOptions) {
    return await this.groupRepository.deleteUserFromGroup(id_group, id_user);
  }

  async updateUserInGroup(id_group: number, id_user: number, updateUserGroupDTO: UpdateUserGroupDTO, options?: QueryOptions) {
    return await this.groupRepository.updateUserInGroup(id_group, id_user, updateUserGroupDTO);
  }
}
