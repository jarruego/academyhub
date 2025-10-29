import { Module } from '@nestjs/common';
import { ImportVelneoController } from './import-velneo.controller';
import { ImportVelneoService } from './import-velneo.service';
import { DatabaseModule } from 'src/database/database.module';
import { UserModule } from '../user/user.module';
import { MoodleUserModule } from '../moodle-user/moodle-user.module';
import { CourseModule } from '../course/course.module';
import { CompanyModule } from '../company/company.module';
import { CenterModule } from '../center/center.module';
import { GroupModule } from '../group/group.module';

@Module({
  imports: [DatabaseModule, UserModule, MoodleUserModule, CourseModule, CompanyModule, CenterModule, GroupModule],
  controllers: [ImportVelneoController],
  providers: [ImportVelneoService],
})
export class ImportVelneoModule {}
