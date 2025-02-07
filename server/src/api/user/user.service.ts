import { Injectable } from "@nestjs/common";
import { UserRepository } from "src/database/repository/user/user.repository";
import { CreateUserDTO } from "src/dto/user/create-user.dto";
import { FilterUserDTO } from "src/dto/user/filter-user.dto";
import { UpdateUserDTO } from "src/dto/user/update-user.dto";
import { MoodleService } from "../moodle/moodle.service";
import { QueryOptions } from "src/database/repository/repository";

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly MoodleService: MoodleService
  ) {}

  async findById(id: number, options?: QueryOptions) {
    return await this.userRepository.findById(id, options);
  }

  async create(createUserDTO: CreateUserDTO, options?: QueryOptions) {
    return await this.userRepository.create({
       ...createUserDTO,
      // moodle_id: createUserDTO.moodle_id || null,
      // moodle_username: createUserDTO.moodle_username || null,
      // moodle_password: createUserDTO.moodle_password || null,
    }, options);
  }

  async update(id: number, updateUserDTO: UpdateUserDTO, options?: QueryOptions) {
    await this.userRepository.update(id, updateUserDTO, options);
    return await this.userRepository.findById(id, options);
  }

  async findAll(filter: FilterUserDTO, options?: QueryOptions) {
    return await this.userRepository.findAll(filter, options);
  }

  async delete(id: number, options?: QueryOptions) {
    return await this.userRepository.delete(id, options);
  }

  async importMoodleUsers(options?: QueryOptions) {
    const moodleUsers = await this.MoodleService.getAllUsers();
    for (const moodleUser of moodleUsers) {
      const existingUser = await this.userRepository.findByMoodleId(moodleUser.id, options);
      if (existingUser) {
        await this.update(existingUser.id_user, {
          name: moodleUser.firstname,
          first_surname: moodleUser.lastname,
          email: moodleUser.email,
          moodle_username: moodleUser.username,
          moodle_id: moodleUser.id,
        }, options);
      } else {
        await this.create({
          name: moodleUser.firstname,
          first_surname: moodleUser.lastname,
          email: moodleUser.email,
          moodle_username: moodleUser.username,
          moodle_id: moodleUser.id,
        }, options);
      }
    }
    return { message: 'Usuarios importados y actualizados correctamente' }; 
  }
}
