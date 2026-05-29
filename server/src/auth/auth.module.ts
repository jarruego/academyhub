import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthUserModule } from "./auth_user/auth_user.module";
import { RevokedTokenRepository } from "./revoked-token.repository";
import { RevokedTokenService } from "./revoked-token.service";

@Module({
  imports: [AuthUserModule],
  providers: [AuthService, RevokedTokenRepository, RevokedTokenService],
  controllers: [AuthController],
  exports: [RevokedTokenService],
})
export class AuthModule {}
