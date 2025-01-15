import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthUserModule } from "./auth_user/auth_user.module";

@Module({
  imports: [AuthUserModule],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
