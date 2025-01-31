import { Injectable } from "@nestjs/common";
import { UserRepository } from "src/database/repository/user/user.repository";
import { CreateUserDTO } from "src/dto/user/create-user.dto";
import { FilterUserDTO } from "src/dto/user/filter-user.dto";
import { UpdateUserDTO } from "src/dto/user/update-user.dto";
import { MoodleService } from "../moodle/moodle.service";

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly MoodleService: MoodleService
  ) {}

  async findById(id: number) {
    return await this.userRepository.findById(id);
  }

  async create(createUserDTO: CreateUserDTO) {
    return await this.userRepository.create({
      ...createUserDTO,
      moodle_id: createUserDTO.moodle_id || null,
      moodle_username: createUserDTO.moodle_username || null,
      moodle_password: createUserDTO.moodle_password || null,
    });
  }

  async update(id: number, updateUserDTO: UpdateUserDTO) {
    await this.userRepository.update(id, updateUserDTO);
    return await this.userRepository.findById(id);
  }

  async findAll(filter: FilterUserDTO) {
    return await this.userRepository.findAll(filter);
  }

  async delete(id: number) {
    return await this.userRepository.delete(id);
  }

  async importMoodleUsers() {
    const moodleUsers = await this.MoodleService.getAllUsers();
    for (const moodleUser of moodleUsers) {
      const existingUser = await this.userRepository.findByMoodleId(moodleUser.id);
      if (existingUser) {
        await this.update(existingUser.id_user, {
          name: moodleUser.firstname,
          surname: moodleUser.lastname,
          email: moodleUser.email,
          moodle_username: moodleUser.username,
          moodle_id: moodleUser.id,
        });
      } else {
        await this.create({
          name: moodleUser.firstname,
          surname: moodleUser.lastname,
          email: moodleUser.email,
          moodle_username: moodleUser.username,
          moodle_id: moodleUser.id,
        });
      }
    }
    return { message: 'Usuarios importados y actualizados correctamente' }; 
  }
}
