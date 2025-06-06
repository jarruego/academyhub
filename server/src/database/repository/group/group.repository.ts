import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { GroupInsertModel, GroupSelectModel, groupTable, GroupUpdateModel } from "src/database/schema/tables/group.table";
import { eq, ilike, and } from "drizzle-orm";
import { CreateGroupDTO } from "src/dto/group/create-group.dto";
import { MoodleGroup } from "src/types/moodle/group";

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

  async create(data: GroupInsertModel, options?: QueryOptions) {
    const result = await this.query(options)
      .insert(groupTable)
      .values(data).returning({ id: groupTable.id_group });
    return result;
  }

  async update(id: number, data: GroupUpdateModel, options?: QueryOptions) {
    const result = await this.query(options)
      .update(groupTable)
      .set(data)
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
      description: moodleGroup.description || '',
      // TODO: Moodle not providing this fields
      fundae_id: '', 
      start_date: null,
      end_date: null  
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
