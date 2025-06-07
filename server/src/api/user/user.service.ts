import { Inject, Injectable } from "@nestjs/common";
import { UserRepository } from "src/database/repository/user/user.repository";
import { MoodleService } from "../moodle/moodle.service";
import { QueryOptions } from "src/database/repository/repository";
import { MoodleUser } from "src/types/moodle/user";
import { GroupRepository } from "src/database/repository/group/group.repository";
import { GroupService } from "../group/group.service";
import { UserGroupRepository } from "src/database/repository/group/user-group.repository";
import { UserInsertModel, UserSelectModel, UserUpdateModel } from "src/database/schema/tables/user.table";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";
import { CenterRepository } from "src/database/repository/center/center.repository";
import { eq } from "drizzle-orm";
import { userCenterTable } from "src/database/schema/tables/user_center.table";
import { CompanyRepository } from "src/database/repository/company/company.repository";

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly MoodleService: MoodleService,
    private readonly groupService: GroupService,
    private readonly userGroupRepository: UserGroupRepository,
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService,
    private readonly centerRepository: CenterRepository,
    private readonly companyRepository: CompanyRepository
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
      // Get all users
      const users = await this.userRepository.findAll(userSelectModel, { transaction });
      // For each user, get their main center (is_main_center = true) and company name
      const usersWithMainCenter = await Promise.all(
        users.map(async (user: any) => {
          const userCenter = await transaction
            .select()
            .from(userCenterTable)
            .where(
              eq(userCenterTable.id_user, user.id_user)
            );
          // Find the main center in the userCenter array
          const mainUserCenter = userCenter.find((uc: any) => uc.is_main_center === true);
          if (mainUserCenter) {
            const center = await this.centerRepository.findById(mainUserCenter.id_center, { transaction });
            let companyName = null;
            if (center) {
              const company = await this.companyRepository.findOne(center.id_company, { transaction });
              companyName = company?.company_name || null;
            }
            return {
              ...user,
              main_center: center ? {
                id_center: center.id_center,
                center_name: center.center_name,
                id_company: center.id_company,
                company_name: companyName
              } : null
            };
          } else {
            return {
              ...user,
              main_center: null
            };
          }
        })
      );
      return usersWithMainCenter;
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

      const userGroupRows = await this.userGroupRepository.findUserInGroup(userId, id_group, { transaction });

      if (userGroupRows.length <= 0) {
        await this.groupService.addUserToGroup({id_group, id_user: userId}, { transaction });
      }

    });

  }

  async bulkCreateAndAddToGroup(users: UserInsertModel[], id_group: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const createdUsers = [];
      for (const user of users) {
        const existingUser = await this.userRepository.findByMoodleId(user.moodle_id, { transaction });
        let userId: number;
        if (existingUser) {
          await this.userRepository.update(existingUser.id_user, user, { transaction });
          userId = existingUser.id_user;
        } else {
          const result = await this.userRepository.create(user, { transaction });
          userId = result.insertId;
        }
        createdUsers.push(userId);
        const userGroupRows = await this.userGroupRepository.findUserInGroup(userId, id_group, { transaction });
        if (userGroupRows.length <= 0) {
          await this.groupService.addUserToGroup({id_group, id_user: userId }, { transaction });
        }
      }
      return createdUsers;
    });
  }

  async findCentersByUserId(id_user: number) {
    return await (this.databaseService.db).transaction(async transaction => {
      // Get all user_center records for the user
      const userCenters = await transaction
        .select()
        .from(userCenterTable)
        .where(eq(userCenterTable.id_user, id_user));
      if (!userCenters.length) return [];
      // For each user_center, get the center and add is_main_center and dates
      const centers = await Promise.all(
        userCenters.map(async (uc: any) => {
          const center = await this.centerRepository.findById(uc.id_center, { transaction });
          if (!center) return null;
          // Get the company name
          const company = await this.companyRepository.findOne(center.id_company, { transaction });
          return {
            ...center,
            company_name: company?.company_name || null,
            is_main_center: uc.is_main_center,
            start_date: uc.start_date,
            end_date: uc.end_date
          };
        })
      );
      return centers.filter(Boolean);
    });
  }
}
