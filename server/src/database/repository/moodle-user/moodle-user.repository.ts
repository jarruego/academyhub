import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { 
  MoodleUserInsertModel, 
  MoodleUserSelectModel, 
  moodleUserTable, 
  MoodleUserUpdateModel 
} from "src/database/schema/tables/moodle_user.table";
import { eq, ilike, and } from "drizzle-orm";

@Injectable()
export class MoodleUserRepository extends Repository {
  
  async findById(id: number, options?: QueryOptions) {
    const rows = await this.query(options)
      .select()
      .from(moodleUserTable)
      .where(eq(moodleUserTable.id_moodle_user, id));
    return rows?.[0];
  }

  async create(data: MoodleUserInsertModel, options?: QueryOptions): Promise<{ insertId: number }> {
    const result = await this.query(options)
      .insert(moodleUserTable)
      .values(data)
      .returning({ insertId: moodleUserTable.id_moodle_user });
    return result[0];
  }

  async update(id: number, data: MoodleUserUpdateModel, options?: QueryOptions) {
    const result = await this.query(options)
      .update(moodleUserTable)
      .set(data)
      .where(eq(moodleUserTable.id_moodle_user, id));
    return result;
  }

  async delete(id: number, options?: QueryOptions) {
    const result = await this.query(options)
      .delete(moodleUserTable)
      .where(eq(moodleUserTable.id_moodle_user, id));
    return result;
  }

  async findAll(filter: Partial<MoodleUserSelectModel>, options?: QueryOptions) {
    const where = [];

    if (filter.id_moodle_user) where.push(eq(moodleUserTable.id_moodle_user, filter.id_moodle_user));
    if (filter.id_user) where.push(eq(moodleUserTable.id_user, filter.id_user));
    if (filter.moodle_id) where.push(eq(moodleUserTable.moodle_id, filter.moodle_id));
    if (filter.moodle_username) where.push(ilike(moodleUserTable.moodle_username, `%${filter.moodle_username}%`));
    if (filter.moodle_password) where.push(ilike(moodleUserTable.moodle_password, `%${filter.moodle_password}%`));

    return await this.query(options)
      .select()
      .from(moodleUserTable)
      .where(and(...where));
  }

  /**
   * Buscar usuario de Moodle por moodle_id
   */
  async findByMoodleId(moodleId: number, options?: QueryOptions) {
    const rows = await this.query(options)
      .select()
      .from(moodleUserTable)
      .where(eq(moodleUserTable.moodle_id, moodleId));
    return rows?.[0];
  }

  /**
   * Buscar todos los usuarios de Moodle asociados a un usuario específico
   */
  async findByUserId(userId: number, options?: QueryOptions) {
    const rows = await this.query(options)
      .select()
      .from(moodleUserTable)
      .where(eq(moodleUserTable.id_user, userId));
    return rows;
  }

  /**
   * Buscar usuario de Moodle por username
   */
  async findByUsername(username: string, options?: QueryOptions) {
    const rows = await this.query(options)
      .select()
      .from(moodleUserTable)
      .where(eq(moodleUserTable.moodle_username, username));
    return rows?.[0];
  }

  /**
   * Verificar si ya existe un usuario de Moodle con el mismo moodle_id o username
   */
  async checkDuplicates(moodleId: number, username: string, excludeId?: number, options?: QueryOptions) {
    const whereConditions = [
      eq(moodleUserTable.moodle_id, moodleId),
      eq(moodleUserTable.moodle_username, username)
    ];

    if (excludeId) {
      whereConditions.push(eq(moodleUserTable.id_moodle_user, excludeId));
    }

    const rows = await this.query(options)
      .select()
      .from(moodleUserTable)
      .where(and(...whereConditions));
    
    return rows.length > 0;
  }
}