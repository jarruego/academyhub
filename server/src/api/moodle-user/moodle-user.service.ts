import { Inject, Injectable } from "@nestjs/common";
import { MoodleUserRepository } from "src/database/repository/moodle-user/moodle-user.repository";
import { UserCourseRepository } from 'src/database/repository/course/user-course.repository';
import { QueryOptions } from "src/database/repository/repository";
import { 
  MoodleUserInsertModel, 
  MoodleUserSelectModel, 
  MoodleUserUpdateModel 
} from "src/database/schema/tables/moodle_user.table";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";
import { MoodleUser } from "src/types/moodle/user";

@Injectable()
export class MoodleUserService {
  constructor(
    private readonly moodleUserRepository: MoodleUserRepository,
    private readonly userCourseRepository: UserCourseRepository,
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService,
  ) { }

  async findById(id: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.moodleUserRepository.findById(id, { transaction });
    });
  }

  async create(moodleUserInsertModel: MoodleUserInsertModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.moodleUserRepository.create(moodleUserInsertModel, { transaction });
    });
  }

  async update(id: number, moodleUserUpdateModel: MoodleUserUpdateModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      await this.moodleUserRepository.update(id, moodleUserUpdateModel, { transaction });
      return await this.moodleUserRepository.findById(id, { transaction });
    });
  }

  async findAll(filter: Partial<MoodleUserSelectModel>, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.moodleUserRepository.findAll(filter, { transaction });
    });
  }

  async delete(id: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.moodleUserRepository.delete(id, { transaction });
    });
  }

  /**
   * Buscar usuario de Moodle por moodle_id
   */
  async findByMoodleId(moodleId: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.moodleUserRepository.findByMoodleId(moodleId, { transaction });
    });
  }

  /**
   * Buscar todos los usuarios de Moodle asociados a un usuario específico
   */
  async findByUserId(userId: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.moodleUserRepository.findByUserId(userId, { transaction });
    });
  }

  /**
   * Buscar usuario de Moodle por username
   */
  async findByUsername(username: string, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.moodleUserRepository.findByUsername(username, { transaction });
    });
  }

  /**
   * Crear o actualizar usuario de Moodle basado en datos de la API de Moodle
   */
  async upsertFromMoodleUser(moodleUser: MoodleUser, userId: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const existingMoodleUser = await this.moodleUserRepository.findByMoodleId(moodleUser.id, { transaction });
      
      const data: MoodleUserInsertModel = {
        id_user: userId,
        moodle_id: moodleUser.id,
        moodle_username: moodleUser.username,
        moodle_password: undefined, // No almacenamos contraseñas desde la API
      };

      if (existingMoodleUser) {
        // Actualizar usuario existente
        await this.moodleUserRepository.update(existingMoodleUser.id_moodle_user, {
          id_user: userId,
          moodle_username: moodleUser.username,
        }, { transaction });
        return existingMoodleUser;
      } else {
        // Crear nuevo usuario de Moodle
        const result = await this.moodleUserRepository.create(data, { transaction });
        return await this.moodleUserRepository.findById(result.insertId, { transaction });
      }
    });
  }

  /**
   * Vincular usuario existente con cuenta de Moodle
   */
  async linkUserToMoodle(userId: number, moodleId: number, moodleUsername: string, moodlePassword?: string, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      // Verificar si ya existe este usuario de Moodle
      const existingMoodleUser = await this.moodleUserRepository.findByMoodleId(moodleId, { transaction });
      
      if (existingMoodleUser) {
        throw new Error(`Ya existe un usuario de Moodle con ID ${moodleId}`);
      }

      // Verificar si ya existe este username
      const existingUsername = await this.moodleUserRepository.findByUsername(moodleUsername, { transaction });
      
      if (existingUsername) {
        throw new Error(`Ya existe un usuario de Moodle con username ${moodleUsername}`);
      }

      const data: MoodleUserInsertModel = {
        id_user: userId,
        moodle_id: moodleId,
        moodle_username: moodleUsername,
        moodle_password: moodlePassword,
      };

      const result = await this.moodleUserRepository.create(data, { transaction });
      return await this.moodleUserRepository.findById(result.insertId, { transaction });
    });
  }

  /**
   * Desvincular usuario de cuenta de Moodle
   */
  async unlinkUserFromMoodle(moodleUserId: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.moodleUserRepository.delete(moodleUserId, { transaction });
    });
  }

  /**
   * Obtener cursos asociados a un usuario de Moodle (id_moodle_user)
   */
  async findCoursesByMoodleUserId(moodleUserId: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.userCourseRepository.findCoursesByMoodleUserId(moodleUserId, { transaction });
    });
  }

  /**
   * Obtener estadísticas de usuarios de Moodle
   */
  async getStats(options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const allMoodleUsers = await this.moodleUserRepository.findAll({}, { transaction });
      
      // Agrupar por usuario
      const userStats = allMoodleUsers.reduce((acc, moodleUser) => {
        const userId = moodleUser.id_user;
        if (!acc[userId]) {
          acc[userId] = { userId, moodleAccountsCount: 0 };
        }
        acc[userId].moodleAccountsCount++;
        return acc;
      }, {} as Record<number, { userId: number; moodleAccountsCount: number }>);

      return {
        totalMoodleUsers: allMoodleUsers.length,
        usersWithMoodleAccounts: Object.keys(userStats).length,
        usersWithMultipleMoodleAccounts: Object.values(userStats).filter(stat => stat.moodleAccountsCount > 1).length,
        userStats: Object.values(userStats),
      };
    });
  }

  /**
   * Inicializar todos los moodle_usernames a formato `user_<id_moodle_user>`
   */
  async initializeUsernames(options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const allMoodleUsers = await this.moodleUserRepository.findAll({}, { transaction });

      for (const mu of allMoodleUsers) {
        const newUsername = `user_${mu.id_moodle_user}`;
        // Actualizar solo si es diferente (evita llamadas innecesarias)
        if (mu.moodle_username !== newUsername) {
          await this.moodleUserRepository.update(mu.id_moodle_user, { moodle_username: newUsername }, { transaction });
        }
      }

      return { updated: allMoodleUsers.length };
    });
  }
}