
import { Module } from "@nestjs/common";
import { AuthUserService } from "./auth_user.service";
import { AuthUserRepository } from "src/database/repository/auth/auth_user.repository";
import { AuthUserController } from "./auth_user.controller";

@Module({
  providers: [AuthUserService, AuthUserRepository],
  controllers: [AuthUserController],
  exports: [AuthUserService],
})
export class AuthUserModule {}
