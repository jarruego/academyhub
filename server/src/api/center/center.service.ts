import { Injectable, NotFoundException } from "@nestjs/common";
import { CenterRepository } from "src/database/repository/center/center.repository";
import { CompanyRepository } from "src/database/repository/company/company.repository";
import { QueryOptions } from "src/database/repository/repository";
import { CreateCenterDTO } from "src/dto/center/create-center.dto";
import { FilterCenterDTO } from "src/dto/center/filter-center.dto";
import { UpdateCenterDTO } from "src/dto/center/update-center.dto";
import { CreateUserCenterDTO } from "src/dto/user-center/create-user-center.dto";
import { UpdateUserCenterDTO } from "src/dto/user-center/update-user-center.dto";

@Injectable()
export class CenterService {
  constructor(
    private readonly centerRepository: CenterRepository,
    private readonly companyRepository: CompanyRepository
  ) {}

  async findById(id: number, options?: QueryOptions) {
    return await this.centerRepository.findById(id, options);
  }

  async findAll(filter: FilterCenterDTO, options?: QueryOptions) {
    return await this.centerRepository.findAll(filter, options);
  }

  async create(createCenterDTO: CreateCenterDTO, options?: QueryOptions) {
    const company = await this.companyRepository.findOne(createCenterDTO.id_company, options);
    if (!company) {
      throw new NotFoundException(`Company with ID ${createCenterDTO.id_company} not found`);
    }
    return await this.centerRepository.create(createCenterDTO, options);
  }

  async update(id: number, updateCenterDTO: UpdateCenterDTO, options?: QueryOptions) {
    const company = await this.companyRepository.findOne(updateCenterDTO.id_company, options);
    if (!company) {
      throw new NotFoundException(`Company with ID ${updateCenterDTO.id_company} not found`);
    }
    await this.centerRepository.update(id, updateCenterDTO, options);
    return await this.centerRepository.findById(id, options);
  }

  async deleteById(id: number, options?: QueryOptions) {
    const center = await this.centerRepository.findById(id, options);
    if (!center) {
      throw new NotFoundException(`Center with ID ${id} not found`);
    }
    return await this.centerRepository.deleteById(id, options);
  }

  async addUserToCenter(createUserCenterDTO: CreateUserCenterDTO, options?: QueryOptions) {
    return await this.centerRepository.addUserToCenter(createUserCenterDTO, options);
  }

  async findUsersInCenter(centerId: number, options?: QueryOptions) {
    return await this.centerRepository.findUsersInCenter(centerId, options);
  }

  async updateUserInCenter(id_center: number, id_user: number, updateUserCenterDTO: UpdateUserCenterDTO, options?: QueryOptions) {
    return await this.centerRepository.updateUserInCenter(id_center, id_user, updateUserCenterDTO, options);
  }

  async deleteUserFromCenter(id_center: number, id_user: number, options?: QueryOptions) {
    return await this.centerRepository.deleteUserFromCenter(id_center, id_user, options);
  }
}