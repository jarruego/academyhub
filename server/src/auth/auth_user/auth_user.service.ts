import { Injectable } from "@nestjs/common";
import { AuthUserRepository } from "src/database/repository/auth/auth_user.repository";
import { AuthUserInsertModel, AuthUserSelectModel, AuthUserUpdateModel } from "src/database/schema/tables/auth_user.table";
import { CreateUserDTO } from "src/dto/auth/create-user.dto";
import { UpdateUserDTO } from "src/dto/auth/update-user.dto";
import { hashWithSalt } from "src/utils/crypto/password-hashing.util";

@Injectable()
export class AuthUserService {
  constructor(private readonly authUserRepository: AuthUserRepository) {}

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

  async findAll(): Promise<Omit<AuthUserSelectModel, 'password'>[]> {
    const users = await this.authUserRepository.findAll();
    return users.map(({ password, ...rest }) => rest);
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
}
