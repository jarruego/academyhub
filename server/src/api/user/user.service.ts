import { Inject, Injectable } from "@nestjs/common";
import { UserRepository } from "src/database/repository/user/user.repository";
import { MoodleService } from "../moodle/moodle.service";
import { QueryOptions } from "src/database/repository/repository";
import { MoodleUser } from "src/types/moodle/user";
import { GroupRepository } from "src/database/repository/group/group.repository";
import { GroupService } from "../group/group.service";
import { UserInsertModel, UserSelectModel, UserUpdateModel } from "src/database/schema/tables/user.table";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly MoodleService: MoodleService,
    private readonly groupRepository: GroupRepository,
    private readonly groupService: GroupService,
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService
  ) { }

  async findById(id: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.userRepository.findById(id, { transaction });
    });
  }

  async create(userInsertModel: UserInsertModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.userRepository.create(userInsertModel, { transaction });
    });
  }

  async update(id: number, userUpdateModel: UserUpdateModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      await this.userRepository.update(id, userUpdateModel, { transaction });
      return await this.userRepository.findById(id, { transaction });
    });
  }

  async findAll(userSelectModel: UserSelectModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.userRepository.findAll(userSelectModel, { transaction });
    });
  }

  async delete(id: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.userRepository.delete(id, { transaction });
    });
  }

  async importMoodleUsers(options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const moodleUsers = await this.MoodleService.getAllUsers();
      for (const moodleUser of moodleUsers) {
        const existingUser = await this.userRepository.findByMoodleId(moodleUser.id, { transaction });
        if (existingUser) {
          await this.update(existingUser.id_user, {
            name: moodleUser.firstname,
            first_surname: moodleUser.lastname,
            email: moodleUser.email,
            moodle_username: moodleUser.username,
            moodle_id: moodleUser.id,
          } as UserUpdateModel, { transaction });
        } else {
          await this.create({
            name: moodleUser.firstname,
            first_surname: moodleUser.lastname,
            email: moodleUser.email,
            moodle_username: moodleUser.username,
            moodle_id: moodleUser.id,
          } as UserInsertModel, { transaction });
        }
      }
      return { message: 'Usuarios importados y actualizados correctamente' };
    });
  }

  async upsertMoodleUserByGroup(moodleUser: MoodleUser, id_group: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const existingUser = await this.userRepository.findByMoodleId(moodleUser.id, { transaction });
      const data = {
        name: moodleUser.firstname,
        first_surname: moodleUser.lastname,
        email: moodleUser.email,
        moodle_username: moodleUser.username,
        moodle_id: moodleUser.id,
      } as UserInsertModel;

      let userId: number;

      if (existingUser) {
        await this.userRepository.update(existingUser.id_user, data, { transaction });
        userId = existingUser.id_user;
      } else {
        const result = await this.userRepository.create(data, { transaction });
        userId = result.insertId;
      }

      const userGroupRows = await this.groupRepository.findUserInGroup(userId, id_group, { transaction });

      if (userGroupRows.length <= 0) {
        await this.groupService.addUserToGroup(id_group, userId, { transaction });
      }

    });

  }
}
