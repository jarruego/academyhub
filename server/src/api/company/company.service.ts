import { Inject, Injectable } from "@nestjs/common";
import { CompanyRepository } from "src/database/repository/company/company.repository";
import { CenterRepository } from "src/database/repository/center/center.repository";
import { QueryOptions } from "src/database/repository/repository";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";
import { CompanyInsertModel, CompanySelectModel, CompanyUpdateModel } from "src/database/schema/tables/company.table";

@Injectable()
export class CompanyService {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly centerRepository: CenterRepository,
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService
  ) { }

  async findByCIF(cif: string, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.companyRepository.findByCIF(cif, { transaction });
    });
  }

  async create(companyInsertModel: CompanyInsertModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.companyRepository.create(companyInsertModel, { transaction });
    });
  }

  async update(id: number, companyUpdateModel: CompanyUpdateModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      await this.companyRepository.update(id, companyUpdateModel, { transaction });
      return await this.companyRepository.findOne(id, { transaction });
    });
  }

  async findOne(id: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.companyRepository.findOne(id, { transaction });
    });
  }

  async findAll(filter: CompanySelectModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.companyRepository.findAll(filter, { transaction });
    });
  }

  async delete(id: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.companyRepository.delete(id, { transaction });
    });
  }

  async findCentersByCompanyId(companyId: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.centerRepository.findByCompanyId(companyId, { transaction });
    });
  }
}