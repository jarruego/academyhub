import { Inject, Injectable } from "@nestjs/common";
import { GroupRepository } from "src/database/repository/group/group.repository";
import { CreateGroupDTO } from "src/dto/group/create-group.dto";
import { UpdateGroupDTO } from "src/dto/group/update-group.dto";
import { FilterGroupDTO } from "src/dto/group/filter-group.dto";
import { UpdateUserGroupDTO } from "src/dto/user-group/update-user-group.dto";
import { QueryOptions } from "src/database/repository/repository";
import { CourseRepository } from "src/database/repository/course/course.repository";
import { EnrollmentStatus } from "src/types/user-course/enrollment-status.enum";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";

@Injectable()
export class GroupService {
  constructor(private readonly groupRepository: GroupRepository,
    private readonly courseRepository: CourseRepository,
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService
  ) { }

  async findById(id: number, options?: QueryOptions) {
    return await this.groupRepository.findById(id);
  }

  async create(createGroupDTO: CreateGroupDTO, options?: QueryOptions) {
    return await this.groupRepository.create(createGroupDTO);
  }

  async update(id: number, updateGroupDTO: UpdateGroupDTO, options?: QueryOptions) {
    await this.groupRepository.update(id, updateGroupDTO);
    return await this.groupRepository.findById(id);
  }

  async findAll(filter: FilterGroupDTO, options?: QueryOptions) {
    return await this.groupRepository.findAll(filter);
  }

  async addUserToGroup(id_group: number, id_user: number, options?: QueryOptions) {
    return await this.databaseService.db.transaction(async transaction => {
      const result = await this.groupRepository.addUserToGroup(id_group, id_user, {transaction});

      // Get the id_course of the group
      const group = await this.groupRepository.findById(id_group, {transaction});
      const id_course = group.id_course;

      // Check if the user is already in the course
      const usersInCourse = await this.courseRepository.findUsersInCourse(id_course, {transaction});
      const userExistsInCourse = usersInCourse.some(user => user.id_user === id_user);

      // Associate user with the corresponding course if not already in the course
      if (!userExistsInCourse) {
        await this.courseRepository.addUserToCourse({
          id_user: id_user,
          id_course: id_course,
          enrollment_date: new Date(),
          status: EnrollmentStatus.ACTIVE,
          completion_percentage: 0,
          time_spent: 0
        });
      }

      return result;
    });
  }

  async findUsersInGroup(groupId: number, options?: QueryOptions) {
    return await this.groupRepository.findUsersInGroup(groupId);
  }

  async deleteById(id: number, options?: QueryOptions) {
    return await this.groupRepository.deleteById(id);
  }

  async deleteUserFromGroup(id_group: number, id_user: number, options?: QueryOptions) {
    return await this.databaseService.db.transaction(async transaction => {

    const result = await this.groupRepository.deleteUserFromGroup(id_group, id_user, {transaction});

    // Check if the user is enrolled in other groups of the same course
    const isEnrolledInOtherGroups = await this.groupRepository.isUserEnrolledInOtherGroups(id_group, id_user, {transaction});

    // If the user is not enrolled in any other groups of the same course, remove them from the course
    if (!isEnrolledInOtherGroups) {
      const group = await this.groupRepository.findById(id_group, {transaction});
      await this.courseRepository.deleteUserFromCourse(id_user, group.id_course, {transaction});
    }
    return result;
  });
  }

  async updateUserInGroup(id_group: number, id_user: number, updateUserGroupDTO: UpdateUserGroupDTO, options?: QueryOptions) {
    return await this.groupRepository.updateUserInGroup(id_group, id_user, updateUserGroupDTO);
  }

  async findUserByGroup(id_user: number, id_group: number, options?: QueryOptions) {
    return await this.groupRepository.findUserByGroup(id_user, id_group, options);
  }
}
