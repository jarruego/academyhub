import { Inject, Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { GroupSelectModel, groupTable, GroupUpdateModel } from "src/database/schema/tables/group.table";
import { eq, ilike, and } from "drizzle-orm";
import { CreateGroupDTO } from "src/dto/group/create-group.dto";
import { userGroupTable } from "src/database/schema/tables/user_group.table";
// import { CreateUserGroupDTO } from "src/dto/user-group/create-user-group.dto";
import { userTable } from "src/database/schema/tables/user.table";
import { CourseRepository } from "../course/course.repository";
// import { EnrollmentStatus } from "src/types/user-course/enrollment-status.enum";
import { UpdateUserGroupDTO } from "src/dto/user-group/update-user-group.dto";
import { MoodleGroup } from "src/types/moodle/group";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";

@Injectable()
export class GroupRepository extends Repository {

  constructor(private readonly courseRepository: CourseRepository, @Inject(DATABASE_PROVIDER) dbService: DatabaseService) {
    super(dbService);
  }

  async findById(id: number, options?: QueryOptions) {
    const rows = await this.query(options).select().from(groupTable).where(eq(groupTable.id_group, id));
    return rows?.[0];
  }

  async findByMoodleId(moodleId: number, options?: QueryOptions) {
    const rows = await this.query(options).select().from(groupTable).where(eq(groupTable.moodle_id, moodleId));
    return rows?.[0];
  }

  async create(createGroupDTO: CreateGroupDTO, options?: QueryOptions) {
    const result = await this.query(options)
      .insert(groupTable)
      .values(createGroupDTO).returning({ id: groupTable.id_group });
    return result;
  }

  async update(id: number, updateGroupDTO: GroupUpdateModel, options?: QueryOptions) {
    const result = await this.query(options)
      .update(groupTable)
      .set(updateGroupDTO)
      .where(eq(groupTable.id_group, id));
    return result;
  }

  async findAll(filter: Partial<GroupSelectModel>, options?: QueryOptions) {
    const where = [];
    if (filter.moodle_id) where.push(eq(groupTable.moodle_id, filter.moodle_id));
    if (filter.group_name) where.push(ilike(groupTable.group_name, `%${filter.group_name}%`));
    if (filter.id_course) where.push(eq(groupTable.id_course, filter.id_course));
    if (filter.description) where.push(ilike(groupTable.description, `%${filter.description}%`));
    // if (filter.start_date) where.push(eq(groupTable.start_date, filter.start_date));
    // if (filter.end_date) where.push(eq(groupTable.end_date, filter.end_date));

    return await this.query(options).select().from(groupTable).where(and(...where));
  }

  async addUserToGroup(id_group: number, id_user: number, options?: QueryOptions) {
    const result = await this.query(options)
      .insert(userGroupTable)
      .values({
        id_user,
        id_group
      });

    // // Get the id_course of the group
    // const group = await this.findById(id_group);
    // const id_course = group.id_course;

    // // Associate user with the corresponding course
    // await this.courseRepository.addUserToCourse({
    //   id_user: id_user,
    //   id_course: id_course,
    //   enrollment_date: new Date(),
    //   status: EnrollmentStatus.ACTIVE,
    //   completion_percentage: 0,
    //   time_spent: 0
    // });

    return result;
  }

  async findUsersInGroup(groupId: number, options?: QueryOptions) {
    const rows = await this.query(options)
      .select({
        id_user: userTable.id_user,
        username: userTable.moodle_username,
        email: userTable.email,
        name: userTable.name,
        surname: userTable.surname,
        moodle_id: userTable.moodle_id,
        id_group: userGroupTable.id_group,
        completion_percentage: userGroupTable.completion_percentage,
        id_center: userGroupTable.id_center,
        time_spent: userGroupTable.time_spent,
      })
      .from(userGroupTable)
      .innerJoin(userTable, eq(userGroupTable.id_user, userTable.id_user))
      .where(eq(userGroupTable.id_group, groupId));
    return rows;
  }

  async updateUserInGroup(id_group: number, id_user: number, updateUserGroupDTO: UpdateUserGroupDTO, options?: QueryOptions) {
    const result = await this.query(options)
      .update(userGroupTable)
      .set(updateUserGroupDTO)
      .where(and(eq(userGroupTable.id_group, id_group), eq(userGroupTable.id_user, id_user)));
    return result;
  }

  async deleteUserFromGroup(id_group: number, id_user: number, options?: QueryOptions) {
    const result = await this.query(options)
      .delete(userGroupTable)
      .where(and(eq(userGroupTable.id_group, id_group), eq(userGroupTable.id_user, id_user)));

    // Check if the user is enrolled in other groups of the same course
    const group = await this.findById(id_group);
    const otherGroups = await this.query(options)
      .select()
      .from(userGroupTable)
      .innerJoin(groupTable, eq(userGroupTable.id_group, groupTable.id_group))
      .where(and(eq(userGroupTable.id_user, id_user), eq(groupTable.id_course, group.id_course)));

    // If the user is not enrolled in any other groups of the same course, remove them from the course
    if (otherGroups.length === 0) {
      const courseRepository = new CourseRepository(this.dbService);
      await courseRepository.deleteUserFromCourse(id_user, group.id_course, options);
    }
    return result;
  }

  async deleteById(id: number, options?: QueryOptions) {
    const result = await this.query(options)
      .delete(groupTable)
      .where(eq(groupTable.id_group, id));
    return result;
  }

  async upsertMoodleGroup(moodleGroup: MoodleGroup, id_course: number, options?: QueryOptions) {
    const data = {
      group_name: moodleGroup.name,
      moodle_id: moodleGroup.id,
      id_course: id_course,
      description: moodleGroup.description || ''
    };
    const existingGroup = await this.findByMoodleId(moodleGroup.id, options);
    if (existingGroup) {
      await this.update(existingGroup.id_group, data, options);
      return await this.findByMoodleId(moodleGroup.id, options); // TODO: optimize
    } else {
      const newGroup = await this.create(data, options);
      return await this.findById(newGroup[0].id, options);
    }
  }

  async findGroupsByCourseId(courseId: number, options?: QueryOptions) {
    const rows = await this.query(options).select().from(groupTable).where(eq(groupTable.id_course, courseId));
    return rows;
  }
}
