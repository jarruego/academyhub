import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { UserRepository } from "src/database/repository/user/user.repository";
import { MoodleService } from "../moodle/moodle.service";
import { MoodleUserService } from "../moodle-user/moodle-user.service";
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
    private readonly MoodleService: MoodleService,
    private readonly moodleUserService: MoodleUserService,
    private readonly groupService: GroupService,
    private readonly userGroupRepository: UserGroupRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly userRepository: UserRepository,
    private readonly centerRepository: CenterRepository,
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService,
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
      // Obtener todos los usuarios
      const users = await this.userRepository.findAll(userSelectModel, { transaction });
      // Para cada usuario, obtener todos sus centros y el main_center
      const usersWithCenters = await Promise.all(
        users.map(async (user: any) => {
          const userCenters = await transaction
            .select()
            .from(userCenterTable)
            .where(eq(userCenterTable.id_user, user.id_user));

          // Array de centros completos
          const centers = await Promise.all(
            userCenters.map(async (uc: any) => {
              const center = await this.centerRepository.findById(uc.id_center, { transaction });
              if (!center) return null;
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
          // main_center para compatibilidad
          const mainUserCenter = centers.find((c: any) => c && c.is_main_center === true) || null;
          return {
            ...user,
            centers: centers.filter(Boolean),
            main_center: mainUserCenter
          };
        })
      );
      return usersWithCenters;
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
        // Buscar si ya existe un usuario de Moodle con este moodle_id
        const existingMoodleUser = await this.moodleUserService.findByMoodleId(moodleUser.id, { transaction });
        
        let userId: number;
        
        if (existingMoodleUser) {
          // Si existe el usuario de Moodle, actualizamos el usuario principal y el usuario de Moodle
          userId = existingMoodleUser.id_user;
          
          // Actualizar usuario principal
          await this.userRepository.update(userId, {
            name: moodleUser.firstname,
            first_surname: moodleUser.lastname,
            email: moodleUser.email,
          } as UserUpdateModel, { transaction });
          
          // Actualizar usuario de Moodle
          await this.moodleUserService.update(existingMoodleUser.id_moodle_user, {
            moodle_username: moodleUser.username,
          }, { transaction });
          
        } else {
          // Crear nuevo usuario principal
          const userResult = await this.userRepository.create({
            name: moodleUser.firstname,
            first_surname: moodleUser.lastname,
            email: moodleUser.email,
          } as UserInsertModel, { transaction });
          
          userId = userResult.insertId;
          
          // Crear usuario de Moodle asociado
          await this.moodleUserService.create({
            id_user: userId,
            moodle_id: moodleUser.id,
            moodle_username: moodleUser.username,
          }, { transaction });
        }
      }
      
      return { message: 'Usuarios importados y actualizados correctamente' };
    });
  }

  async upsertMoodleUserByGroup(moodleUser: MoodleUser, id_group: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      // Buscar si ya existe un usuario de Moodle con este moodle_id
      const existingMoodleUser = await this.moodleUserService.findByMoodleId(moodleUser.id, { transaction });
      
      let userId: number;

      if (existingMoodleUser) {
        // Si existe el usuario de Moodle, actualizamos el usuario principal
        userId = existingMoodleUser.id_user;
        
        await this.userRepository.update(userId, {
          name: moodleUser.firstname,
          first_surname: moodleUser.lastname,
          email: moodleUser.email,
        } as UserUpdateModel, { transaction });
        
        // Actualizar usuario de Moodle
        await this.moodleUserService.update(existingMoodleUser.id_moodle_user, {
          moodle_username: moodleUser.username,
        }, { transaction });
        
      } else {
        // Crear nuevo usuario principal
        const userResult = await this.userRepository.create({
          name: moodleUser.firstname,
          first_surname: moodleUser.lastname,
          email: moodleUser.email,
        } as UserInsertModel, { transaction });
        
        userId = userResult.insertId;
        
        // Crear usuario de Moodle asociado
        await this.moodleUserService.create({
          id_user: userId,
          moodle_id: moodleUser.id,
          moodle_username: moodleUser.username,
        }, { transaction });
      }

      // Verificar si el usuario ya está en el grupo
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
        let userId: number;
        
        // Para now, crear usuarios sin datos de Moodle directamente
        // TODO: Implementar lógica de Moodle cuando se defina cómo asociar cursos
        const result = await this.userRepository.create(user, { transaction });
        userId = result.insertId;
        
        createdUsers.push(userId);
        
        // Añadir al grupo si no está ya
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
