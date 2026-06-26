import { Module } from "@nestjs/common";
import { DatabaseModule } from "src/database/database.module";
import { UserSanitizationController } from "./user-sanitization.controller";
import { UserSanitizationService } from "./user-sanitization.service";

@Module({
  imports: [DatabaseModule],
  controllers: [UserSanitizationController],
  providers: [UserSanitizationService],
  exports: [UserSanitizationService],
})
export class UserSanitizationModule {}
