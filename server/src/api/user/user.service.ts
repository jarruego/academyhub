import { Inject, Injectable } from "@nestjs/common";
import { UserRepository } from "src/database/repository/user/user.repository";
import { MoodleUserService } from "../moodle-user/moodle-user.service";
import { QueryOptions } from "src/database/repository/repository";
import { GroupService } from "../group/group.service";
import { UserGroupRepository } from "src/database/repository/group/user-group.repository";
import { UserInsertModel, UserSelectModel, UserUpdateModel } from "src/database/schema/tables/user.table";
import { MoodleUserSelectModel } from 'src/database/schema/tables/moodle_user.table';
import { UserCenterSelectModel } from "src/database/schema/tables/user_center.table";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";
import { CenterRepository } from "src/database/repository/center/center.repository";
import { UserCourseRepository } from "src/database/repository/course/user-course.repository";
import { eq, sql, and } from "drizzle-orm";
import { DbCondition } from 'src/database/types/db-expression';
import { userCenterTable } from "src/database/schema/tables/user_center.table";
import { CompanyRepository } from "src/database/repository/company/company.repository";
import { users } from "src/database/schema";
import { FilterUserDTO } from "src/dto/user/filter-user.dto";
import { PaginatedUsersResult, UserWithCenters } from "src/types/user/paginated-users.interface";
import { resolveInsertId } from 'src/utils/db';

@Injectable()
export class UserService {
  constructor(
    private readonly moodleUserService: MoodleUserService,
    private readonly groupService: GroupService,
    private readonly userGroupRepository: UserGroupRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly userRepository: UserRepository,
    private readonly centerRepository: CenterRepository,
    private readonly userCourseRepository: UserCourseRepository,
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService,
  ) { }

  async findById(id: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.userRepository.findById(id, { transaction });
    });
  }

  async create(userInsertModel: UserInsertModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const res = await this.userRepository.create(userInsertModel, { transaction });
      // Use shared helper to resolve various driver return shapes (insertId, insert_id, id or arrays)
      const newId = resolveInsertId(res as unknown);
      if (newId) {
        return await this.userRepository.findById(Number(newId), { transaction });
      }
      // If repository did not return insert id for some reason, return the raw result
      return res;
    });
  }

  async update(id: number, userUpdateModel: UserUpdateModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      await this.userRepository.update(id, userUpdateModel, { transaction });
      return await this.userRepository.findById(id, { transaction });
    });
  }

  async findAll(userSelectModel: UserSelectModel, options?: QueryOptions): Promise<UserWithCenters[]> {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      // Obtener todos los usuarios
      const users = await this.userRepository.findAll(userSelectModel, { transaction });
      // Para cada usuario, obtener todos sus centros y el main_center
      const usersWithCenters = await Promise.all(
        users.map(async (user: UserSelectModel) => {
          const userCenters = await transaction
            .select()
            .from(userCenterTable)
            .where(eq(userCenterTable.id_user, user.id_user));

          // Array de centros completos
          const centers = await Promise.all(
            userCenters.map(async (uc: UserCenterSelectModel) => {
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
          const mainUserCenter = centers.find(c => c && c.is_main_center === true) || null;
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

  async findAllPaginated(filter: FilterUserDTO, options?: QueryOptions): Promise<PaginatedUsersResult> {
    // Delegate DB work to repository; repository returns raw users (no centers enrichment)
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const result = await this.userRepository.findAllPaginated(filter, { transaction });

      // Enriquecer cada usuario con sus centros (igual que antes)
      const usersWithCenters = await Promise.all(
        (result.data || []).map(async (user: UserSelectModel) => {
          const userCenters = await transaction
            .select()
            .from(userCenterTable)
            .where(eq(userCenterTable.id_user, user.id_user));

          const centers = await Promise.all(
            userCenters.map(async (uc: UserCenterSelectModel) => {
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

          const mainUserCenter = centers.find(c => c && c.is_main_center === true) || null;
          return {
            ...user,
            centers: centers.filter(Boolean),
            main_center: mainUserCenter
          };
        })
      );

      return {
        data: usersWithCenters,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      } as PaginatedUsersResult;
    });
  }

  /**
   * Devuelve solo campos mínimos para búsquedas/lookup (sin enriquecer con centros)
   * Esto evita el coste de múltiples consultas por usuario cuando solo necesitamos el DNI
   */
  async findAllMinimal(filter: Partial<FilterUserDTO> = {}, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
  const where: DbCondition[] = [];
      if (filter.dni) where.push(sql`unaccent(lower(${users.dni})) LIKE unaccent(lower(${`%${filter.dni}%`}))`);
      if (filter.name) where.push(sql`unaccent(lower(${users.name})) LIKE unaccent(lower(${`%${filter.name}%`}))`);

      const whereCondition = where.length > 0 ? and(...where) : undefined;

      const list = await transaction
        .select({ id_user: users.id_user, dni: users.dni, name: users.name, first_surname: users.first_surname, second_surname: users.second_surname })
        .from(users)
        .where(whereCondition)
        .orderBy(users.id_user);

      return list;
    });
  }

  async delete(id: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      // If the user has any moodle_user mappings, delete them first to avoid FK
      try {
        const moodleRows: MoodleUserSelectModel[] = await this.moodleUserService.findByUserId(id, { transaction });
        if (Array.isArray(moodleRows) && moodleRows.length > 0) {
          for (const mr of moodleRows) {
            if (mr && mr.id_moodle_user) {
              await this.moodleUserService.delete(mr.id_moodle_user, { transaction });
            }
          }
        }
      } catch (e) {
        // Log & continue - do not block deletion if we can't remove moodle mappings
        // (but prefer failing loudly in future if desired)
      }

      return await this.userRepository.delete(id, { transaction });
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
  const maybeId = resolveInsertId(result as unknown);
  userId = Number(maybeId);
        
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
        userCenters.map(async (uc: UserCenterSelectModel) => {
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

  async findCoursesByUserId(id_user: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const courses = await this.userCourseRepository.findCoursesByUserId(id_user, { transaction });
      const enriched = await Promise.all(
        (courses || []).map(async (course) => {
          const groups = await this.userGroupRepository.findGroupsByUserAndCourse(
            id_user,
            course.id_course,
            { transaction }
          );
          return { ...course, groups };
        })
      );
      return enriched;
    });
  }
  /**
   * Buscar usuario por DNI
   */
  async findByDni(dni: string, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const result = await this.userRepository.findByDni(dni, { transaction });
      // El repositorio devuelve un array, pero por si acaso, forzamos array vacío si no hay resultado
      return Array.isArray(result) ? result : (result ? [result] : []);
    });
  }

  /**
   * Bulk update multiple users in a single request.
   * Returns updatedIds and failedIds for partial reporting.
   */
  async bulkUpdate(updates: { id_user: number; data: UserUpdateModel }[]) {
    return await this.databaseService.db.transaction(async transaction => {
      const updatedIds: number[] = [];
      const failedIds: number[] = [];

      for (const u of updates) {
        try {
          await this.userRepository.update(u.id_user, u.data, { transaction });
          updatedIds.push(u.id_user);
        } catch (err) {
          // Collect failed id and continue with others
          failedIds.push(u.id_user);
        }
      }

      return { updatedIds, failedIds };
    });
  }
}
