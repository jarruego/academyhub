import { Module } from "@nestjs/common";
import { DatabaseModule } from "src/database/database.module";
import { UserMergeController } from "./user-merge.controller";
import { UserMergeService } from "./user-merge.service";

@Module({
  imports: [DatabaseModule],
  controllers: [UserMergeController],
  providers: [UserMergeService],
  exports: [UserMergeService],
})
export class UserMergeModule {}
