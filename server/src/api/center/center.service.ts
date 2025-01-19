import { Injectable, NotFoundException } from "@nestjs/common";
import { CenterRepository } from "src/database/repository/center/center.repository";
import { CompanyRepository } from "src/database/repository/company/company.repository";
import { CreateCenterDTO } from "src/dto/center/create-center.dto";
import { FilterCenterDTO } from "src/dto/center/filter-center.dto";
import { UpdateCenterDTO } from "src/dto/center/update-center.dto";

@Injectable()
export class CenterService {
  constructor(
    private readonly centerRepository: CenterRepository,
    private readonly companyRepository: CompanyRepository
  ) {}

  async findById(id: number) {
    return await this.centerRepository.findById(id);
  }

  async findAll(filter: FilterCenterDTO) {
    return await this.centerRepository.findAll(filter);
  }

  async create(createCenterDTO: CreateCenterDTO) {
    const company = await this.companyRepository.findOne(createCenterDTO.id_company);
    if (!company) {
      throw new NotFoundException(`Company with ID ${createCenterDTO.id_company} not found`);
    }
    return await this.centerRepository.create(createCenterDTO);
  }

  async update(id: number, updateCenterDTO: UpdateCenterDTO) {
    const company = await this.companyRepository.findOne(updateCenterDTO.id_company);
    if (!company) {
      throw new NotFoundException(`Company with ID ${updateCenterDTO.id_company} not found`);
    }
    await this.centerRepository.update(id, updateCenterDTO);
    return await this.centerRepository.findById(id);
  }
}