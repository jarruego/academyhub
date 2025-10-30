import { Inject, Injectable } from "@nestjs/common";
import { UserRepository } from "src/database/repository/user/user.repository";
import { MoodleUserService } from "../moodle-user/moodle-user.service";
import { QueryOptions } from "src/database/repository/repository";
import { GroupRepository } from "src/database/repository/group/group.repository";
import { GroupService } from "../group/group.service";
import { UserGroupRepository } from "src/database/repository/group/user-group.repository";
import { UserInsertModel, UserSelectModel, UserUpdateModel } from "src/database/schema/tables/user.table";
import { UserCenterSelectModel } from "src/database/schema/tables/user_center.table";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";
import { CenterRepository } from "src/database/repository/center/center.repository";
import { UserCourseRepository } from "src/database/repository/course/user-course.repository";
import { eq, ilike, or, sql, and, count } from "drizzle-orm";
import { userCenterTable } from "src/database/schema/tables/user_center.table";
import { CompanyRepository } from "src/database/repository/company/company.repository";
import { users } from "src/database/schema";
import { FilterUserDTO } from "src/dto/user/filter-user.dto";
import { PaginatedUsersResult, UserWithCenters } from "src/types/user/paginated-users.interface";

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
      return await this.userRepository.create(userInsertModel, { transaction });
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
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const page = filter.page || 1;
      const limit = filter.limit || 100;
      const offset = (page - 1) * limit;

      // Construir condiciones de filtrado
      const conditions = [];
      
      if (filter.search) {
        // Normalizar el término de búsqueda: eliminar espacios extras
        // NOTE: usamos la extensión Postgres `unaccent` para que la búsqueda ignore
        // tildes y la 'ñ' (por ejemplo 'CARREÑO' <-> 'CARRENO'). Asegúrate de tener
        // la extensión instalada: `CREATE EXTENSION IF NOT EXISTS unaccent;`
        const normalizedSearch = filter.search.trim().replace(/\s+/g, ' ');
        const searchTerm = `%${normalizedSearch}%`;

        // Helper para comparar usando unaccent + lower
        const unaccentLike = (col: any, term: string) => sql`unaccent(lower(${col})) LIKE unaccent(lower(${term}))`;

        // Crear condiciones para buscar con espacios normalizados
        const searchWords = normalizedSearch.split(' ').filter(word => word.length > 0);

        if (searchWords.length === 1) {
          // Búsqueda simple con un término
          conditions.push(
            or(
              // Usar unaccent + lower para hacer la comparación insensible a diacríticos
              unaccentLike(users.name, searchTerm),
              unaccentLike(users.first_surname, searchTerm),
              unaccentLike(users.second_surname, searchTerm),
              unaccentLike(users.email, searchTerm),
              unaccentLike(users.dni, searchTerm)
            )
          );
        } else {
          // Búsqueda con múltiples palabras - permite encontrar "Juan Pérez" aunque se busque "juan perez"
          const multiWordConditions: any[] = [];

          // Buscar cada palabra individualmente en cualquier campo
          searchWords.forEach(word => {
            const wordTerm = `%${word}%`;
            multiWordConditions.push(
              or(
                unaccentLike(users.name, wordTerm),
                unaccentLike(users.first_surname, wordTerm),
                unaccentLike(users.second_surname, wordTerm),
                unaccentLike(users.email, wordTerm),
                unaccentLike(users.dni, wordTerm)
              )
            );
          });

          // Todas las palabras deben encontrarse (AND)
          conditions.push(and(...multiWordConditions));
        }
      }

      // Agregar otros filtros específicos si existen
  // Comparaciones específicas también usando unaccent + lower
  if (filter.dni) conditions.push(sql`unaccent(lower(${users.dni})) LIKE unaccent(lower(${`%${filter.dni}%`}))`);
  if (filter.name) conditions.push(sql`unaccent(lower(${users.name})) LIKE unaccent(lower(${`%${filter.name}%`}))`);
  if (filter.first_surname) conditions.push(sql`unaccent(lower(${users.first_surname})) LIKE unaccent(lower(${`%${filter.first_surname}%`}))`);
  if (filter.email) conditions.push(sql`unaccent(lower(${users.email})) LIKE unaccent(lower(${`%${filter.email}%`}))`);

      const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

      // Contar total de registros
      const totalResult = await transaction
        .select({ count: count() })
        .from(users)
        .where(whereCondition);
      
      const total = totalResult[0]?.count || 0;

      // Obtener usuarios paginados
      const usersList = await transaction
        .select()
        .from(users)
        .where(whereCondition)
        .orderBy(users.id_user)
        .limit(limit)
        .offset(offset);

      // Para cada usuario, obtener todos sus centros
      const usersWithCenters = await Promise.all(
        usersList.map(async (user: UserSelectModel) => {
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
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    });
  }

  async delete(id: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
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
      return await this.userCourseRepository.findCoursesByUserId(id_user, { transaction });
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
}
