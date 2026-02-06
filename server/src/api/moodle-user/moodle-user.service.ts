import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { MoodleUserRepository } from "src/database/repository/moodle-user/moodle-user.repository";
import { UserCourseRepository } from 'src/database/repository/course/user-course.repository';
import { UserGroupRepository } from 'src/database/repository/group/user-group.repository';
import { QueryOptions } from "src/database/repository/repository";
import { 
  MoodleUserInsertModel, 
  MoodleUserSelectModel, 
  MoodleUserUpdateModel 
} from "src/database/schema/tables/moodle_user.table";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";
import { MoodleUser } from "src/types/moodle/user";
import { resolveInsertId } from 'src/utils/db';
import { userTable } from 'src/database/schema/tables/user.table';
import { eq } from 'drizzle-orm';

@Injectable()
export class MoodleUserService {
  constructor(
    private readonly moodleUserRepository: MoodleUserRepository,
    private readonly userCourseRepository: UserCourseRepository,
    private readonly userGroupRepository: UserGroupRepository,
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
  const newId = resolveInsertId(result as unknown);
  return await this.moodleUserRepository.findById(Number(newId), { transaction });
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
  const newId = resolveInsertId(result as unknown);
  return await this.moodleUserRepository.findById(Number(newId), { transaction });
    });
  }

  /**
   * Desvincular usuario de cuenta de Moodle
   */
  async unlinkUserFromMoodle(moodleUserId: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const moodleUser = await this.moodleUserRepository.findById(moodleUserId, { transaction });
      if (moodleUser?.id_user) {
        await this.userGroupRepository.clearMoodleSyncedAtByUserId(moodleUser.id_user, { transaction });
      }
      // Clear FK references in user_course before deleting moodle_user
      await this.userCourseRepository.clearMoodleUserId(moodleUserId, { transaction });
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
   * Para cada usuario local, marcar solo un registro de moodle_users como is_main_user = true.
   * Criterio: el registro con mayor moodle_id será el main; el resto quedarán a false.
   * También actualiza moodle_username: el main recibe DNI en minúsculas, los demás DNI+moodle_id.
   */
  async setMainUserByHighestMoodleId(options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const allMoodleUsers = await this.moodleUserRepository.findAll({}, { transaction });

      // Agrupar por id_user
      const groups = allMoodleUsers.reduce((acc, mu) => {
        const key = mu.id_user;
        if (!acc[key]) acc[key] = [];
        acc[key].push(mu);
        return acc;
      }, {} as Record<number, typeof allMoodleUsers>);

      let updated = 0;

      for (const [userIdStr, rows] of Object.entries(groups)) {
        const userId = Number(userIdStr);
        
        // Obtener DNI del usuario local
        const [localUser] = await transaction.select({ dni: userTable.dni }).from(userTable).where(eq(userTable.id_user, userId));
        const dni = localUser?.dni ? String(localUser.dni).trim().toLowerCase() : null;

        // encontrar el moodle_id máximo
        const maxRow = rows.reduce((prev, cur) => (cur.moodle_id > prev.moodle_id ? cur : prev), rows[0]);

        if (!dni) {
          // Sin DNI, solo actualizar is_main_user
          for (const row of rows) {
            const shouldBeMain = row.id_moodle_user === maxRow.id_moodle_user;
            if (row.is_main_user !== shouldBeMain) {
              await this.moodleUserRepository.update(row.id_moodle_user, { is_main_user: shouldBeMain }, { transaction });
              updated++;
            }
          }
          continue;
        }

        // FASE 1: Asignar usernames temporales únicos para evitar conflictos de unicidad
        for (const row of rows) {
          const tempUsername = `temp_${row.id_moodle_user}_${Date.now()}`;
          if (row.moodle_username !== tempUsername) {
            await this.moodleUserRepository.update(row.id_moodle_user, { 
              moodle_username: tempUsername 
            }, { transaction });
          }
        }

        // Verificar si el DNI simple ya está en uso por OTRO usuario (fuera de este grupo)
        const currentMoodleUserIds = rows.map(r => r.id_moodle_user);
        const existingWithDni = await this.moodleUserRepository.findByUsername(dni, { transaction });
        const dniAlreadyTaken = existingWithDni && !currentMoodleUserIds.includes(existingWithDni.id_moodle_user);

        // FASE 2: Asignar usernames finales e is_main_user
        for (const row of rows) {
          const shouldBeMain = row.id_moodle_user === maxRow.id_moodle_user;
          // Si el DNI ya está tomado por otro usuario, usar formato dni_moodleid incluso para el main
          const finalUsername = (shouldBeMain && !dniAlreadyTaken) ? dni : `${dni}_${row.moodle_id}`;
          
          await this.moodleUserRepository.update(row.id_moodle_user, { 
            is_main_user: shouldBeMain,
            moodle_username: finalUsername
          }, { transaction });
          updated++;
        }
      }

      return { totalLocalUsers: Object.keys(groups).length, totalMoodleRows: allMoodleUsers.length, updated };
    });
  }

  /**
   * Marcar un moodle_user concreto como el principal para su usuario local.
   * Desmarca los demás moodle_users asociados al mismo id_user.
   */
  async setMainMoodleUser(moodleUserId: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const target = await this.moodleUserRepository.findById(moodleUserId, { transaction });
      if (!target) {
        throw new NotFoundException(`Moodle user ${moodleUserId} not found`);
      }

      // Obtener todas las cuentas de Moodle del usuario local y actualizar flags
      const siblings = await this.moodleUserRepository.findByUserId(target.id_user, { transaction });

      for (const s of siblings) {
        const shouldBeMain = s.id_moodle_user === moodleUserId;
        if (s.is_main_user !== shouldBeMain) {
          await this.moodleUserRepository.update(s.id_moodle_user, { is_main_user: shouldBeMain }, { transaction });
        }
      }

      // devolver las filas actualizadas
      return await this.moodleUserRepository.findByUserId(target.id_user, { transaction });
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