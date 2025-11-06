import { Inject, Injectable } from "@nestjs/common";
import { GroupRepository } from "src/database/repository/group/group.repository";
import { QueryOptions } from "src/database/repository/repository";
// import { EnrollmentStatus } from "src/types/user-course/enrollment-status.enum";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";
import { GroupInsertModel, GroupSelectModel, GroupUpdateModel } from "src/database/schema/tables/group.table";
import { UserGroupUpdateModel, UserGroupInsertModel } from "src/database/schema/tables/user_group.table";
import { GroupBonificableService } from "./group-bonification.service";
import { UserCourseRepository } from "src/database/repository/course/user-course.repository";
import { UserGroupRepository } from "src/database/repository/group/user-group.repository";
import { CenterRepository } from "src/database/repository/center/center.repository";
import { CompanyRepository } from "src/database/repository/company/company.repository";
import { userCenterTable } from "src/database/schema/tables/user_center.table";
import { eq, and } from "drizzle-orm";


type AddUserToGroupOptions = {id_group: number; id_user: number; id_center?: number; id_role?: number }

@Injectable()
export class GroupService {
  constructor(
    private readonly groupRepository: GroupRepository,
    private readonly groupBonificableService: GroupBonificableService,
    private readonly userCourseRepository: UserCourseRepository,
    private readonly userGroupRepository: UserGroupRepository,
    private readonly centerRepository: CenterRepository,
    private readonly companyRepository: CompanyRepository,
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService
  ) { }

  async findById(id: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.groupRepository.findById(id, { transaction });
    });
  }

  async create(groupInsertModel: GroupInsertModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.groupRepository.create(groupInsertModel, { transaction });
    });
  }

  async update(id: number, groupUpdateModel: GroupUpdateModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      await this.groupRepository.update(id, groupUpdateModel, { transaction });
      return await this.groupRepository.findById(id, { transaction });
    });
  }

  async findAll(filter: Partial<GroupSelectModel>, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.groupRepository.findAll(filter, { transaction });
    });
  }

  

  async addUserToGroup({ id_group, id_user, id_center, id_role }: AddUserToGroupOptions, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      // Si no se pasa id_center, buscar el main_center del usuario
      let centerIdToUse = id_center;
      if (typeof centerIdToUse === 'undefined') {
        const mainCenter = await transaction
          .select()
          .from(userCenterTable)
          .where(
            and(
              eq(userCenterTable.id_user, id_user),
              eq(userCenterTable.is_main_center, true)
            )
          );
        centerIdToUse = mainCenter[0]?.id_center ?? null;
      }

  // Comprobar existencia previa en user_group para evitar duplicate inserts
  // (antes hacíamos un insert directo que lanzaba unique violations si ya existía)
  const existingUserGroup = await this.userGroupRepository.findByGroupAndUserId(id_group, id_user, { transaction });

  // Obtener el id_course del grupo
  const group = await this.groupRepository.findById(id_group, { transaction });
  const id_course = group.id_course;

      // Comprobar si el usuario ya está en el curso
      const userCourse = await this.userCourseRepository.findByCourseAndUserId(id_course, id_user, { transaction });

      // Asociar usuario con el curso si no está
      if (!userCourse) {
        await this.userCourseRepository.create({ 
          id_user,
          id_course,
          enrollment_date: new Date(),
          completion_percentage: "0",
          time_spent: 0,
         }, { transaction });
      }

      // Si ya existe la asociación user-group, actualizamos centro si procede
      if (existingUserGroup) {
        if (typeof centerIdToUse !== 'undefined') {
          await this.userGroupRepository.updateById(id_user, id_group, { id_center: centerIdToUse }, { transaction });
        }
        return existingUserGroup;
      }

      // No existía: crear la asociación incluyendo centro/join_date y posible id_role
      const created = await this.userGroupRepository.create({
        id_group,
        id_user,
        id_role: id_role ?? undefined,
        id_center: centerIdToUse,
        join_date: new Date(),
        completion_percentage: "0",
        time_spent: 0,
        last_access: null,
      } as UserGroupInsertModel, { transaction });

      return created;
    });
  }

  async findUsersInGroup(groupId: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      // Get the users in the group
      const users = await this.userGroupRepository.findUsersInGroup(groupId, { transaction });
      // Para cada usuario, obtener todos sus centros y el main_center
      const usersWithCenters = await Promise.all(
        users.map(async (user: any) => {
          // Buscar todos los centros del usuario
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

  async deleteById(id: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.groupRepository.deleteById(id, { transaction });
    });
  }

  async deleteUserFromGroup(id_group: number, id_user: number, options?: QueryOptions) {
    console.log('Deleting user from group:', id_user, id_group);
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {

      // Check if the user is enrolled in other groups of the same course
      const isEnrolledInOtherGroups = await this.userGroupRepository.isUserEnrolledInOtherGroups(id_group, id_user, { transaction });
      console.log('Enrolled in other groups?:', isEnrolledInOtherGroups);

      // If the user is not enrolled in any other groups of the same course, remove them from the course
      if (!isEnrolledInOtherGroups) {
        const group = await this.groupRepository.findById(id_group, { transaction });
        await this.userCourseRepository.deleteUserFromCourse(group.id_course, id_user, { transaction });
      }      
      // Delete the user from the group
      const result = await this.userGroupRepository.deleteUserFromGroup(id_group, id_user, { transaction });
      console.log('User removed from group');

      return result;
    });
  }

  async updateUserInGroup(id_group: number, id_user: number, userGroupUpdateModel: UserGroupUpdateModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.userGroupRepository.updateUserInGroup(id_group, id_user, userGroupUpdateModel, { transaction });
    });
  }

  async findUserInGroup(id_user: number, id_group: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.userGroupRepository.findUserInGroup(id_user, id_group, { transaction });
    });
  }

  async getBonificationFile(groupId: number, userIds: number[]) {
    return await this.groupBonificableService.generateBonificationFile(groupId, userIds);
  }
}
