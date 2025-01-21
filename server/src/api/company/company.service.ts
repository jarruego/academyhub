import { Injectable } from "@nestjs/common";
import { CompanyRepository } from "src/database/repository/company/company.repository";
import { CreateCompanyDTO } from "src/dto/company/create-company.dto";
import { FilterCompanyDTO } from "src/dto/company/filter-company.dto";
import { UpdateCompanyDTO } from "src/dto/company/update-company.dto";

@Injectable()
export class CompanyService {
  constructor(private readonly companyRepository: CompanyRepository) {}

  async findByCIF(cif: string) {
    return await this.companyRepository.findByCIF(cif);
  }
  async create(createCompanyDTO: CreateCompanyDTO) {
    return await this.companyRepository.create(createCompanyDTO);
  }

  async update(id: number, updateCompanyDTO: UpdateCompanyDTO) {
    await this.companyRepository.update(id, updateCompanyDTO);
    return await this.companyRepository.findOne(id);
  }

  async findOne(id: number) {
    return await this.companyRepository.findOne(id);
  }

  async findAll(filter: FilterCompanyDTO) {
    return await this.companyRepository.findAll(filter);
  }

  async delete(id: number) {
    return await this.companyRepository.delete(id);
  }
}