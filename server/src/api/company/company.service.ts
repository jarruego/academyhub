import { Injectable } from "@nestjs/common";
import { CompanyRepository } from "src/database/repository/company/company.repository";
import { CreateCompanyDTO } from "src/dto/company/create-company.dto";
import { FilterCompanyDTO } from "src/dto/company/filter-company.dto";
import { UpdateCompanyDTO } from "src/dto/company/update-company.dto";
import { CenterRepository } from "src/database/repository/center/center.repository";
import { QueryOptions } from "src/database/repository/repository";

@Injectable()
export class CompanyService {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly centerRepository: CenterRepository
  ) {}

  async findByCIF(cif: string, options?: QueryOptions) {
    return await this.companyRepository.findByCIF(cif, options);
  }

  async create(createCompanyDTO: CreateCompanyDTO, options?: QueryOptions) {
    return await this.companyRepository.create(createCompanyDTO, options);
  }

  async update(id: number, updateCompanyDTO: UpdateCompanyDTO, options?: QueryOptions) {
    await this.companyRepository.update(id, updateCompanyDTO, options);
    return await this.companyRepository.findOne(id, options);
  }

  async findOne(id: number, options?: QueryOptions) {
    return await this.companyRepository.findOne(id, options);
  }

  async findAll(filter: FilterCompanyDTO, options?: QueryOptions) {
    return await this.companyRepository.findAll(filter, options);
  }

  async delete(id: number, options?: QueryOptions) {
    return await this.companyRepository.delete(id, options);
  }

  async findCentersByCompanyId(companyId: number, options?: QueryOptions) {
    return await this.centerRepository.findByCompanyId(companyId, options);
  }
}