
import { Injectable } from "@nestjs/common";
import { AuthUserRepository } from "src/database/repository/auth/auth_user.repository";

@Injectable()
export class AuthUserService {
  constructor(private readonly authUserRepository: AuthUserRepository) {}

  async findByUsername(username: string) {
    return await this.authUserRepository.findByUsername(username);
  }
}
