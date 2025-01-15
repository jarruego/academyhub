
import { Module } from "@nestjs/common";
import { AuthUserService } from "./auth_user.service";
import { AuthUserRepository } from "src/database/repository/auth/auth_user.repository";

@Module({
  providers: [AuthUserService, AuthUserRepository],
  exports: [AuthUserService],
})
export class AuthUserModule {}
