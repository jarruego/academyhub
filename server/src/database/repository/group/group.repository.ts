import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { GroupInsertModel, GroupSelectModel, groupTable, GroupUpdateModel } from "src/database/schema/tables/group.table";
import { courseTable } from "src/database/schema/tables/course.table";
import { eq, ilike, and, sql } from "drizzle-orm";
import { DbCondition } from "src/database/types/db-expression";
import { MoodleGroup } from "src/types/moodle/group";
import { InsertResult } from 'src/database/types/insert-result';
import resolveInsertId from 'src/utils/db';

@Injectable()
export class GroupRepository extends Repository {
  async findById(id: number, options?: QueryOptions) {
    const rows = await this.query(options).select().from(groupTable).where(eq(groupTable.id_group, id));
    return rows?.[0];
  }

  async findByMoodleId(moodleId: number, options?: QueryOptions) {
    const rows = await this.query(options).select().from(groupTable).where(eq(groupTable.moodle_id, moodleId));
    return rows?.[0];
  }

  async create(data: GroupInsertModel, options?: QueryOptions): Promise<InsertResult> {
    const result = await this.query(options)
      .insert(groupTable)
      .values(data)
      .returning({ insertId: groupTable.id_group });
    return result?.[0] ?? {};
  }

  async update(id: number, data: GroupUpdateModel, options?: QueryOptions) {
    const result = await this.query(options)
      .update(groupTable)
      .set(data)
      .where(eq(groupTable.id_group, id));
    return result;
  }

  async findAll(filter: Partial<GroupSelectModel>, options?: QueryOptions) {
  const where: DbCondition[] = [];
    if (filter.moodle_id) where.push(eq(groupTable.moodle_id, filter.moodle_id));
    if (filter.group_name) where.push(ilike(groupTable.group_name, `%${filter.group_name}%`));
    if (filter.id_course) where.push(eq(groupTable.id_course, filter.id_course));
    if (filter.description) where.push(ilike(groupTable.description, `%${filter.description}%`));
    // if (filter.start_date) where.push(eq(groupTable.start_date, filter.start_date));
    // if (filter.end_date) where.push(eq(groupTable.end_date, filter.end_date));

    return await this.query(options).select().from(groupTable).where(and(...where));
  }

  async deleteById(id: number, options?: QueryOptions) {
    const result = await this.query(options)
      .delete(groupTable)
      .where(eq(groupTable.id_group, id));
    return result;
  }

  async upsertMoodleGroup(moodleGroup: MoodleGroup, id_course: number, options?: QueryOptions) {
    // Base mapping from Moodle data. We intentionally DO NOT include
    // start_date, end_date or fundae_id here for updates because Moodle
    // doesn't provide those fields and we want to preserve local values
    // when they already exist.
    const baseData: Partial<GroupInsertModel> = {
      group_name: moodleGroup.name,
      moodle_id: moodleGroup.id,
      id_course: id_course,
      description: moodleGroup.description || '',
    };

    const existingGroup = await this.findByMoodleId(moodleGroup.id, options);
    if (existingGroup) {
      // Preserve existing local metadata (start_date, end_date, fundae_id).
      // Only update fields that Moodle provides (name, description, moodle_id, id_course).
      await this.update(existingGroup.id_group, baseData as GroupUpdateModel, options);
      return await this.findByMoodleId(moodleGroup.id, options); // TODO: optimize
    } else {
      // When creating a new group, initialize the optional metadata to sensible defaults.
      const data: GroupInsertModel = {
        ...baseData as GroupInsertModel,
        fundae_id: '',
        start_date: null,
        end_date: null,
      };
      const newGroup = await this.create(data, options);
      const newId = resolveInsertId(newGroup as unknown);
      if (!newId) return null;
      return await this.findById(newId, options);
    }
  }

  async findGroupsByCourseId(courseId: number, options?: QueryOptions) {
    const rows = await this.query(options).select().from(groupTable).where(eq(groupTable.id_course, courseId));
    return rows;
  }

  /**
   * Active groups: end_date >= NOW() - 24h (grace period).
   * Returns groups with their course info in a single query.
   */
  async findActiveGroupsWithCourse(options?: QueryOptions) {
    const now = new Date();
    const threshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return await this.query(options)
      .select({ group: groupTable, course: courseTable })
      .from(groupTable)
      .innerJoin(courseTable, eq(groupTable.id_course, courseTable.id_course))
      .where(and(
        sql`${groupTable.end_date} is not null`,
        sql`${groupTable.end_date} >= ${threshold}`
      ));
  }
}
