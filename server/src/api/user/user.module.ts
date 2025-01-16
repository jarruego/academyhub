import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserRepository } from 'src/database/repository/user/user.repository';

@Module({
  providers: [UserService, UserRepository],
  controllers: [UserController],
  exports: [UserService, UserRepository],
})
export class UserModule {}
