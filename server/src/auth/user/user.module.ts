
import { Module } from "@nestjs/common";
import { UserService } from "./user.service";
import { UserRepository } from "src/database/repository/auth/user.repository";

@Module({
  providers: [UserService, UserRepository],
  exports: [UserService],
})
export class UserModule {}
