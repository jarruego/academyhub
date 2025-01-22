import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserRepository } from 'src/database/repository/user/user.repository';
import { MoodleService } from 'src/api/moodle/moodle.service';

@Module({
  providers: [UserService, UserRepository, MoodleService],
  controllers: [UserController],
  exports: [UserService, UserRepository],
})
export class UserModule {}
