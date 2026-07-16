import { Module } from "@nestjs/common";
import { DatabaseModule } from "src/database/database.module";
import { MoodleModule } from "src/api/moodle/moodle.module";
import { MoodleAuditController } from "./moodle-audit.controller";
import { MoodleAuditService } from "./moodle-audit.service";

@Module({
  imports: [DatabaseModule, MoodleModule],
  controllers: [MoodleAuditController],
  providers: [MoodleAuditService],
})
export class MoodleAuditModule {}
