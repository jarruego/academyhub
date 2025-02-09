import { Injectable } from "@nestjs/common";
import { UserRepository } from "src/database/repository/user/user.repository";
import { CreateUserDTO } from "src/dto/user/create-user.dto";
import { FilterUserDTO } from "src/dto/user/filter-user.dto";
import { UpdateUserDTO } from "src/dto/user/update-user.dto";
import { MoodleService } from "../moodle/moodle.service";
import { QueryOptions } from "src/database/repository/repository";
import { MoodleUser } from "src/types/moodle/user";
import { GroupRepository } from "src/database/repository/group/group.repository";
import { GroupService } from "../group/group.service";
import { UserInsertModel } from "src/database/schema/tables/user.table";

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly MoodleService: MoodleService,
    private readonly groupRepository: GroupRepository,
    private readonly groupService: GroupService
  ) {}

  async findById(id: number, options?: QueryOptions) {
    return await this.userRepository.findById(id, options);
  }

  async create(userInsertModel: UserInsertModel, options?: QueryOptions) {
    return await this.userRepository.create(userInsertModel, options);
  }

  async update(id: number, updateUserDTO: UpdateUserDTO, options?: QueryOptions) {
    await this.userRepository.update(id, updateUserDTO, options);
    return await this.userRepository.findById(id, options);
  }

  async findAll(filter: FilterUserDTO, options?: QueryOptions) {
    return await this.userRepository.findAll(filter, options);
  }

  async delete(id: number, options?: QueryOptions) {
    return await this.userRepository.delete(id, options);
  }

  async importMoodleUsers(options?: QueryOptions) {
    const moodleUsers = await this.MoodleService.getAllUsers();
    for (const moodleUser of moodleUsers) {
      const existingUser = await this.userRepository.findByMoodleId(moodleUser.id, options);
      if (existingUser) {
        await this.update(existingUser.id_user, {
          name: moodleUser.firstname,
          first_surname: moodleUser.lastname,
          email: moodleUser.email,
          moodle_username: moodleUser.username,
          moodle_id: moodleUser.id,
          phone: null,
          dni: null,

        }, options);
      } else {
        await this.create({
          name: moodleUser.firstname,
          first_surname: moodleUser.lastname,
          email: moodleUser.email,
          moodle_username: moodleUser.username,
          moodle_id: moodleUser.id,
          phone: null,
          dni: null,
          moodle_password: null,
          second_surname: null,          
        }, options);
      }
    }
    return { message: 'Usuarios importados y actualizados correctamente' }; 
  }

  async upsertMoodleUserByGroup(moodleUser: MoodleUser, id_group: number, options?: QueryOptions) {
    const existingUser = await this.userRepository.findByMoodleId(moodleUser.id, options);

    const data = {
      name: moodleUser.firstname,
      first_surname: moodleUser.lastname,
      email: moodleUser.email,
      moodle_username: moodleUser.username,
      moodle_id: moodleUser.id,
      //TODO: mejorar?
      // phone: null,
      // dni: null,
      // second_surname: "",
      // moodle_password: ""
    } as UserInsertModel;

    let userId: number;

    if (existingUser) {
      await this.userRepository.update(existingUser.id_user, data, options);
      userId = existingUser.id_user;
    } else {
      const result = await this.userRepository.create(data, options);
      userId = result.insertId;
    }

    const userGroupRows = await this.groupRepository.findUserByGroup(userId, id_group, options);

    if (userGroupRows.length <= 0) {
      await this.groupService.addUserToGroup(id_group, userId, options);
    }
  }
}
