import { Inject, Injectable } from "@nestjs/common";
import { GroupRepository } from "src/database/repository/group/group.repository";
import { QueryOptions } from "src/database/repository/repository";
import { CourseRepository } from "src/database/repository/course/course.repository";
// import { EnrollmentStatus } from "src/types/user-course/enrollment-status.enum";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";
import { GroupInsertModel, GroupSelectModel, GroupUpdateModel } from "src/database/schema/tables/group.table";
import { UserGroupUpdateModel } from "src/database/schema/tables/user_group.table";

@Injectable()
export class GroupService {
  constructor(private readonly groupRepository: GroupRepository,
    private readonly courseRepository: CourseRepository,
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

  async findAll(filter: GroupSelectModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.groupRepository.findAll(filter, { transaction });
    });
  }

  async addUserToGroup(id_group: number, id_user: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const result = await this.groupRepository.addUserToGroup(id_group, id_user, { transaction });

      // Get the id_course of the group
      const group = await this.groupRepository.findById(id_group, { transaction });
      const id_course = group.id_course;

      // Check if the user is already in the course
      const usersInCourse = await this.courseRepository.findUsersInCourse(id_course, { transaction });
      const userExistsInCourse = usersInCourse.some(user => user.id_user === id_user);

      // Associate user with the corresponding course if not already in the course
      if (!userExistsInCourse) {
        await this.courseRepository.addUserToCourse({
          id_user: id_user,
          id_course: id_course,
          enrollment_date: new Date(),
          //status: EnrollmentStatus.ACTIVE,
          completion_percentage: "0",
          time_spent: 0
        }, { transaction });
      }

      return result;
    });
  }

  async findUsersInGroup(groupId: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.groupRepository.findUsersInGroup(groupId, { transaction });
    });
  }

  async deleteById(id: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.groupRepository.deleteById(id, { transaction });
    });
  }

  async deleteUserFromGroup(id_group: number, id_user: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {

      const result = await this.groupRepository.deleteUserFromGroup(id_group, id_user, { transaction });

      // Check if the user is enrolled in other groups of the same course
      const isEnrolledInOtherGroups = await this.groupRepository.isUserEnrolledInOtherGroups(id_group, id_user, { transaction });

      // If the user is not enrolled in any other groups of the same course, remove them from the course
      if (!isEnrolledInOtherGroups) {
        const group = await this.groupRepository.findById(id_group, { transaction });
        await this.courseRepository.deleteUserFromCourse(id_user, group.id_course, { transaction });
      }
      return result;
    });
  }

  async updateUserInGroup(id_group: number, id_user: number, userGroupUpdateModel: UserGroupUpdateModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.groupRepository.updateUserInGroup(id_group, id_user, userGroupUpdateModel, { transaction });
    });
  }

  async findUserInGroup(id_user: number, id_group: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.groupRepository.findUserInGroup(id_user, id_group, { transaction });
    });
  }
}
