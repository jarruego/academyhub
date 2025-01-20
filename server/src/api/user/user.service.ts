import { Injectable } from "@nestjs/common";
import { UserRepository } from "src/database/repository/user/user.repository";
import { CreateUserDTO } from "src/dto/user/create-user.dto";
import { FilterUserDTO } from "src/dto/user/filter-user.dto";
import { UpdateUserDTO } from "src/dto/user/update-user.dto";

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
}
