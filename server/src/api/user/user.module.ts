import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserRepository } from 'src/database/repository/user/user.repository';
import { MoodleService } from 'src/api/moodle/moodle.service';
import { GroupModule } from '../group/group.module';

@Module({
  providers: [UserService, UserRepository, MoodleService],
  controllers: [UserController],
  exports: [UserService, UserRepository],
  imports: [GroupModule]
})
export class UserModule {}
