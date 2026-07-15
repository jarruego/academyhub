import { Injectable, Inject } from "@nestjs/common";
import { AuthUserRepository } from "src/database/repository/auth/auth_user.repository";
import { AuthUserInsertModel, AuthUserSelectModel, AuthUserUpdateModel } from "src/database/schema/tables/auth_user.table";
import { CreateUserDTO } from "src/dto/auth/create-user.dto";
import { UpdateUserDTO } from "src/dto/auth/update-user.dto";
import { hashWithSalt } from "src/utils/crypto/password-hashing.util";
import { moodleUserAuthUserTable } from "src/database/schema/tables/moodle_user_auth_user.table";
import { moodleUserTable } from "src/database/schema/tables/moodle_user.table";
import { eq } from "drizzle-orm";
import { DatabaseService } from "src/database/database.service";
import { DATABASE_PROVIDER } from "src/database/database.module";

@Injectable()
export class AuthUserService {
  constructor(
    private readonly authUserRepository: AuthUserRepository,
    @Inject(DATABASE_PROVIDER)
    private readonly dbService: DatabaseService
  ) {}

  async findByUsername(username: string): Promise<AuthUserSelectModel | undefined> {
    return await this.authUserRepository.findByUsername(username);
  }

  async createUser(user: CreateUserDTO) {
    // Ensure password is stored hashed (salted) so authentication comparisons work
    const hashedPassword = hashWithSalt(user.password);

    // Build insert model explicitly to avoid unsafe casts
    const insertUser: AuthUserInsertModel = {
      username: user.username,
      password: hashedPassword,
      email: user.email,
      name: user.name,
      lastName: user.lastName ?? null,
      role: user.role ?? undefined,
    } as AuthUserInsertModel;

    await this.authUserRepository.createUser(insertUser);
    const created = await this.authUserRepository.findByUsername(user.username);
    if (!created) return null;
    const { password, ...rest } = created;
    return rest;
  }

  async findAll(): Promise<(Omit<AuthUserSelectModel, 'password'> & { has_moodle_token: boolean })[]> {
    const users = await this.authUserRepository.findAll();
    // El token vive en los vínculos moodle_user_auth_user (moodle_token NOT NULL):
    // tener algún vínculo equivale a tener token disponible.
    const linkedRows = await this.dbService.db
      .selectDistinct({ id_auth_user: moodleUserAuthUserTable.id_auth_user })
      .from(moodleUserAuthUserTable);
    const linked = new Set(linkedRows.map((r) => r.id_auth_user));
    return users.map(({ password, ...rest }) => ({ ...rest, has_moodle_token: linked.has(rest.id) }));
  }

  async updateUser(id: number, data: UpdateUserDTO): Promise<Omit<AuthUserSelectModel, 'password'> | undefined> {
    // Build update model explicitly so we only change fields provided by the DTO
    const updateData: Partial<AuthUserUpdateModel> = {};

    if (data.username !== undefined) updateData.username = data.username;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.lastName !== undefined) updateData.lastName = data.lastName ?? null;
    if (data.role !== undefined) updateData.role = data.role;

    // Only update password when a non-empty value is provided
    if (data.password !== undefined && data.password !== null && data.password !== '') {
      updateData.password = hashWithSalt(data.password);
    }

    await this.authUserRepository.update(id, updateData as AuthUserUpdateModel);
    const user = await this.authUserRepository.findById(id);
    if (!user) return undefined;
    const { password, ...rest } = user;
    return rest;
  }

  async deleteUser(id: number): Promise<void> {
    await this.authUserRepository.deleteById(id);
  }

  // === Vínculos entre auth_user y moodle_user ===
  async getMoodleLinksByAuthUser(id_auth_user: number) {
    // Join con moodle_users para incluir username
    const db = this.dbService.db;
    return db.select({
      id: moodleUserAuthUserTable.id,
      id_moodle_user: moodleUserAuthUserTable.id_moodle_user,
      id_auth_user: moodleUserAuthUserTable.id_auth_user,
      moodle_token: moodleUserAuthUserTable.moodle_token,
      createdAt: moodleUserAuthUserTable.createdAt,
      updatedAt: moodleUserAuthUserTable.updatedAt,
      moodle_user: {
        id_moodle_user: moodleUserTable.id_moodle_user,
        moodle_username: moodleUserTable.moodle_username,
      },
    })
      .from(moodleUserAuthUserTable)
      .leftJoin(moodleUserTable, eq(moodleUserAuthUserTable.id_moodle_user, moodleUserTable.id_moodle_user))
      .where(eq(moodleUserAuthUserTable.id_auth_user, id_auth_user));
  }

  async addMoodleLink(dto: { id_moodle_user: number; id_auth_user: number; moodle_token: string }) {
    return this.dbService.db.insert(moodleUserAuthUserTable).values(dto).returning();
  }

  async updateMoodleLink(id: number, dto: { moodle_token: string }) {
    return this.dbService.db.update(moodleUserAuthUserTable).set(dto).where(eq(moodleUserAuthUserTable.id, id)).returning();
  }

  async deleteMoodleLink(id: number) {
    return this.dbService.db.delete(moodleUserAuthUserTable).where(eq(moodleUserAuthUserTable.id, id)).returning();
  }
}
