import { Injectable } from "@nestjs/common";
import { CompanyRepository } from "src/database/repository/company/company.repository";
import { CreateCompanyDTO } from "src/dto/company/create-company.dto";
import { UpdateCompanyDTO } from "src/dto/company/update-company.dto";

@Injectable()
export class CompanyService {
  constructor(private readonly companyRepository: CompanyRepository) {}

  async findByCIF(cif: string) {
    return await this.companyRepository.findByCIF(cif);
  }
  async create(createCompanyDTO: CreateCompanyDTO) {
    const company = this.companyRepository.create(createCompanyDTO);
    return await this.companyRepository.save(company);
  }

  async update(id: number, updateCompanyDTO: UpdateCompanyDTO) {
    await this.companyRepository.update(id, updateCompanyDTO);
    return await this.companyRepository.findOne(id);
  }

}