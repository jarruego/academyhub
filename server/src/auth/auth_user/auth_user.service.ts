import { Injectable } from "@nestjs/common";
import { AuthUserRepository } from "src/database/repository/auth/auth_user.repository";
import { AuthUserInsertModel, AuthUserSelectModel, AuthUserUpdateModel } from "src/database/schema/tables/auth_user.table";
import { CreateUserDTO } from "src/dto/auth/create-user.dto";
import { UpdateUserDTO } from "src/dto/auth/update-user.dto";

@Injectable()
export class AuthUserService {
  constructor(private readonly authUserRepository: AuthUserRepository) {}

  async findByUsername(username: string): Promise<AuthUserSelectModel | undefined> {
    return await this.authUserRepository.findByUsername(username);
  }

  async createUser(user: CreateUserDTO) {
    // Delegate to repository; after insert, fetch the created user and return it without password
    // CreateUserDTO is structurally compatible with AuthUserInsertModel for insertion.
    await this.authUserRepository.createUser(user as unknown as AuthUserInsertModel);
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
    // UpdateUserDTO is compatible with AuthUserUpdateModel shape
    await this.authUserRepository.update(id, data as unknown as AuthUserUpdateModel);
    const user = await this.authUserRepository.findById(id);
    if (!user) return undefined;
    const { password, ...rest } = user;
    return rest;
  }

  async deleteUser(id: number): Promise<void> {
    await this.authUserRepository.deleteById(id);
  }
}
