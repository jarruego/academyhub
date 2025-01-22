import { Injectable } from "@nestjs/common";
import { UserRepository } from "src/database/repository/user/user.repository";
import { CreateUserDTO } from "src/dto/user/create-user.dto";
import { FilterUserDTO } from "src/dto/user/filter-user.dto";
import { UpdateUserDTO } from "src/dto/user/update-user.dto";
import { MoodleUser } from 'src/api/moodle/moodle.service';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async findById(id: number) {
    return await this.userRepository.findById(id);
  }

  async create(createUserDTO: CreateUserDTO) {
    return await this.userRepository.create(createUserDTO);
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

  async importMoodleUsers(moodleUsers: MoodleUser[]) {
    const createUserDTOs = moodleUsers.map(user => ({
      name: user.firstname,
      surname: user.lastname,
      email: user.email,
      moodle_username: user.username,
      moodle_id: user.id,
    }));
    return await this.userRepository.bulkCreate(createUserDTOs);
  }
}
